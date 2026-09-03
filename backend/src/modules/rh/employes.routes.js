import { join } from 'node:path';
import { Router } from 'express';
import { asyncHandler, badRequest, forbidden, notFound } from '../../lib/http.js';
import { requirePermission, loadPermissions } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { employeSchema } from './rh.schemas.js';
import { resolveActingEmploye } from './scope.js';
import { uploadPhoto, unlink, UPLOAD_DIR } from '../attachments/storage.js';
import { ARRIVEE_ITEMS, DEPART_ITEMS } from './checklists.constants.js';

const router = Router();

const SELECT_WITH_RESPONSABLE = `
  SELECT e.*, r.nom AS responsable_nom, r.prenom AS responsable_prenom
    FROM rh_employes e
    LEFT JOIN rh_employes r ON r.id = e.responsable_id
`;

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const acting = await resolveActingEmploye(req);
    if (!acting) throw forbidden('Réservé aux comptes self-service');
    const { rows } = await query(`${SELECT_WITH_RESPONSABLE} WHERE e.id = $1`, [acting.employeId]);
    if (!rows[0]) throw notFound('Employé introuvable');
    res.json({ ...rows[0], subordinate_ids: acting.subordinateIds });
  })
);

router.get(
  '/',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`e.statut = $${params.length}`);
    }
    if (req.query.departement) {
      params.push(req.query.departement);
      where.push(`e.departement = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`(e.nom ILIKE $${params.length} OR e.prenom ILIKE $${params.length} OR e.matricule ILIKE $${params.length})`);
    }
    const { rows } = await query(
      `${SELECT_WITH_RESPONSABLE}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY e.nom ASC, e.prenom ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT e.*, r.nom AS responsable_nom, r.prenom AS responsable_prenom,
              (SELECT row_to_json(ct) FROM (
                 SELECT id, numero, type_contrat, date_debut, date_fin, salaire_base, statut
                   FROM rh_contrats WHERE employe_id = e.id AND statut = 'actif'
                  ORDER BY date_debut DESC LIMIT 1
               ) ct) AS contrat_actif
         FROM rh_employes e
         LEFT JOIN rh_employes r ON r.id = e.responsable_id
        WHERE e.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Employé introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = employeSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (matricule, nom, prénom, poste, type de contrat requis)');
    const e = parsed.data;

    const employe = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO rh_employes (matricule, nom, prenom, date_naissance, telephone, email, adresse, poste, departement, date_embauche, type_contrat, salaire_base, responsable_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10, CURRENT_DATE),$11,$12,$13,$14)
         RETURNING *`,
        [e.matricule, e.nom, e.prenom, e.date_naissance || null, e.telephone || null, e.email || null, e.adresse || null, e.poste, e.departement || null, e.date_embauche || null, e.type_contrat, e.salaire_base ?? 0, e.responsable_id || null, req.user.id]
      );
      await client.query(
        `INSERT INTO rh_contrats (employe_id, type_contrat, poste, date_debut, salaire_base, created_by)
         VALUES ($1,$2,$3,COALESCE($4, CURRENT_DATE),$5,$6)`,
        [rows[0].id, e.type_contrat, e.poste, e.date_embauche || null, e.salaire_base ?? 0, req.user.id]
      );
      for (let i = 0; i < ARRIVEE_ITEMS.length; i++) {
        await client.query(
          `INSERT INTO rh_checklist_items (employe_id, type, item_key, label, ordre) VALUES ($1,'arrivee',$2,$3,$4)`,
          [rows[0].id, ARRIVEE_ITEMS[i].item_key, ARRIVEE_ITEMS[i].label, i]
        );
      }
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'employe', entityId: employe.id, ip: req.ip });
    res.status(201).json(employe);
  })
);

router.patch(
  '/:id',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = employeSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const e = parsed.data;
    const { rows } = await query(
      `UPDATE rh_employes SET
         matricule = COALESCE($2, matricule), nom = COALESCE($3, nom), prenom = COALESCE($4, prenom),
         date_naissance = COALESCE($5, date_naissance), telephone = COALESCE($6, telephone), email = COALESCE($7, email),
         adresse = COALESCE($8, adresse), poste = COALESCE($9, poste), departement = COALESCE($10, departement),
         date_embauche = COALESCE($11, date_embauche), type_contrat = COALESCE($12, type_contrat),
         salaire_base = COALESCE($13, salaire_base), responsable_id = COALESCE($14, responsable_id), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, e.matricule, e.nom, e.prenom, e.date_naissance, e.telephone, e.email, e.adresse, e.poste, e.departement, e.date_embauche, e.type_contrat, e.salaire_base, e.responsable_id]
    );
    if (!rows[0]) throw notFound('Employé introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'employe', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut;
    if (!['actif', 'conge', 'suspendu', 'termine'].includes(statut)) throw badRequest('Statut invalide');

    const employe = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE rh_employes SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id, statut]
      );
      if (!rows[0]) throw notFound('Employé introuvable');

      if (statut === 'termine') {
        await client.query(`UPDATE rh_contrats SET statut = 'resilie', updated_at = now() WHERE employe_id = $1 AND statut = 'actif'`, [req.params.id]);

        const { rows: existing } = await client.query(
          `SELECT id FROM rh_checklist_items WHERE employe_id = $1 AND type = 'depart' LIMIT 1`,
          [req.params.id]
        );
        if (existing.length === 0) {
          for (let i = 0; i < DEPART_ITEMS.length; i++) {
            await client.query(
              `INSERT INTO rh_checklist_items (employe_id, type, item_key, label, ordre) VALUES ($1,'depart',$2,$3,$4)`,
              [req.params.id, DEPART_ITEMS[i].item_key, DEPART_ITEMS[i].label, i]
            );
          }
        }
      }

      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'employe', entityId: employe.id, details: { statut }, ip: req.ip });
    res.json(employe);
  })
);

router.post(
  '/:id/photo',
  asyncHandler(async (req, res, next) => {
    const acting = await resolveActingEmploye(req);
    if (acting) {
      if (acting.employeId !== req.params.id) return next(forbidden('Vous ne pouvez modifier que votre propre photo'));
    } else {
      const perms = await loadPermissions(req.user.role_id);
      if (!perms.rh?.update) return next(forbidden('Droit manquant : update sur rh'));
    }
    next();
  }),
  uploadPhoto.single('fichier'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Photo requise (image uniquement, 5 Mo max)');
    const { rows } = await query(
      `UPDATE rh_employes SET photo_chemin = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, req.file.filename]
    );
    if (!rows[0]) {
      await unlink(join(UPLOAD_DIR, req.file.filename)).catch(() => {});
      throw notFound('Employé introuvable');
    }
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'employe', entityId: rows[0].id, details: { photo: true }, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.get(
  '/:id/photo',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT photo_chemin FROM rh_employes WHERE id = $1', [req.params.id]);
    if (!rows[0]?.photo_chemin) throw notFound('Photo introuvable');
    res.sendFile(join(UPLOAD_DIR, rows[0].photo_chemin), (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'not_found', message: 'Fichier introuvable sur le serveur' });
    });
  })
);

export default router;

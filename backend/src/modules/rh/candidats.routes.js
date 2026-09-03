import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { notifyRole } from '../../lib/notifications.js';
import { candidatSchema, entretienSchema, embaucherSchema } from './rh.schemas.js';
import { ARRIVEE_ITEMS } from './checklists.constants.js';

const router = Router();
router.use(requireStaff);

const SELECT_BASE = `
  SELECT c.*, p.titre AS poste_titre, p.departement AS poste_departement, p.type_contrat AS poste_type_contrat
    FROM rh_candidats c
    JOIN rh_postes p ON p.id = c.poste_id
`;

router.get(
  '/',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.poste_id) {
      params.push(req.query.poste_id);
      where.push(`c.poste_id = $${params.length}`);
    }
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`c.statut = $${params.length}`);
    }
    const { rows } = await query(
      `${SELECT_BASE} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY c.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT_BASE} WHERE c.id = $1`, [req.params.id]);
    if (!rows[0]) throw notFound('Candidat introuvable');
    const { rows: entretiens } = await query(
      `SELECT e.*, emp.nom AS evaluateur_nom, emp.prenom AS evaluateur_prenom
         FROM rh_entretiens e LEFT JOIN rh_employes emp ON emp.id = e.evaluateur_id
        WHERE e.candidat_id = $1 ORDER BY e.date_entretien DESC, e.heure_debut DESC`,
      [req.params.id]
    );
    res.json({ ...rows[0], entretiens });
  })
);

router.post(
  '/',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = candidatSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (poste, nom et prénom requis)');
    const c = parsed.data;
    const { rows: posteRows } = await query('SELECT id FROM rh_postes WHERE id = $1', [c.poste_id]);
    if (!posteRows[0]) throw badRequest('Poste introuvable');
    const { rows } = await query(
      `INSERT INTO rh_candidats (poste_id, nom, prenom, email, telephone, source, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [c.poste_id, c.nom, c.prenom, c.email || null, c.telephone || null, c.source || null, c.notes || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'candidat', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = candidatSchema.partial({ poste_id: true, nom: true, prenom: true }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;
    const { rows } = await query(
      `UPDATE rh_candidats SET
         nom = COALESCE($2, nom), prenom = COALESCE($3, prenom), email = COALESCE($4, email),
         telephone = COALESCE($5, telephone), source = COALESCE($6, source), notes = COALESCE($7, notes),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, c.nom, c.prenom, c.email, c.telephone, c.source, c.notes]
    );
    if (!rows[0]) throw notFound('Candidat introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'candidat', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut;
    if (!['recu', 'preselection', 'entretien', 'offre', 'embauche', 'refuse'].includes(statut)) {
      throw badRequest('Statut invalide');
    }
    if (statut === 'embauche') throw badRequest("Utilisez l'action « Embaucher » pour ce statut");
    const candidat = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE rh_candidats SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id, statut]
      );
      if (!rows[0]) throw notFound('Candidat introuvable');
      await notifyRole(client, {
        roleCode: 'direction',
        titre: 'Candidature mise à jour',
        message: `${rows[0].prenom} ${rows[0].nom} est passé(e) au statut « ${statut} ».`,
        moduleCode: 'rh',
        entityType: 'candidat',
        entityId: rows[0].id,
      });
      return rows[0];
    });
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'candidat', entityId: candidat.id, details: { statut }, ip: req.ip });
    res.json(candidat);
  })
);

router.post(
  '/:id/embaucher',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = embaucherSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Matricule requis');
    const e = parsed.data;

    const employe = await withTransaction(async (client) => {
      const { rows: candRows } = await client.query(
        `SELECT c.*, p.titre AS poste_titre, p.departement AS poste_departement, p.type_contrat AS poste_type_contrat
           FROM rh_candidats c JOIN rh_postes p ON p.id = c.poste_id
          WHERE c.id = $1 FOR UPDATE OF c`,
        [req.params.id]
      );
      const candidat = candRows[0];
      if (!candidat) throw notFound('Candidat introuvable');
      if (candidat.employe_id) throw badRequest('Ce candidat a déjà été embauché');

      const { rows: empRows } = await client.query(
        `INSERT INTO rh_employes (matricule, nom, prenom, email, telephone, poste, departement, date_embauche, type_contrat, salaire_base, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, CURRENT_DATE),$9,$10,$11)
         RETURNING *`,
        [
          e.matricule,
          candidat.nom,
          candidat.prenom,
          candidat.email,
          candidat.telephone,
          candidat.poste_titre || candidat.poste_departement || 'Employé',
          candidat.poste_departement,
          e.date_embauche || null,
          candidat.poste_type_contrat,
          e.salaire_base ?? 0,
          req.user.id,
        ]
      );

      await client.query(
        `UPDATE rh_candidats SET employe_id = $2, statut = 'embauche', updated_at = now() WHERE id = $1`,
        [req.params.id, empRows[0].id]
      );

      await client.query(
        `INSERT INTO rh_contrats (employe_id, type_contrat, poste, date_debut, salaire_base, created_by)
         VALUES ($1,$2,$3,COALESCE($4, CURRENT_DATE),$5,$6)`,
        [empRows[0].id, candidat.poste_type_contrat, candidat.poste_titre, e.date_embauche || null, e.salaire_base ?? 0, req.user.id]
      );
      for (let i = 0; i < ARRIVEE_ITEMS.length; i++) {
        await client.query(
          `INSERT INTO rh_checklist_items (employe_id, type, item_key, label, ordre) VALUES ($1,'arrivee',$2,$3,$4)`,
          [empRows[0].id, ARRIVEE_ITEMS[i].item_key, ARRIVEE_ITEMS[i].label, i]
        );
      }

      return empRows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'employe', entityId: employe.id, details: { depuis_candidat: req.params.id }, ip: req.ip });
    res.status(201).json(employe);
  })
);

// --- Entretiens (nichés sous un candidat) ---

router.get(
  '/:candidatId/entretiens',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT e.*, emp.nom AS evaluateur_nom, emp.prenom AS evaluateur_prenom
         FROM rh_entretiens e LEFT JOIN rh_employes emp ON emp.id = e.evaluateur_id
        WHERE e.candidat_id = $1 ORDER BY e.date_entretien DESC`,
      [req.params.candidatId]
    );
    res.json(rows);
  })
);

router.post(
  '/:candidatId/entretiens',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = entretienSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (date requise)');
    const en = parsed.data;
    const { rows: candRows } = await query('SELECT id FROM rh_candidats WHERE id = $1', [req.params.candidatId]);
    if (!candRows[0]) throw notFound('Candidat introuvable');
    const { rows } = await query(
      `INSERT INTO rh_entretiens (candidat_id, evaluateur_id, date_entretien, heure_debut, heure_fin, mode, score, commentaire)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [req.params.candidatId, en.evaluateur_id || null, en.date_entretien, en.heure_debut || null, en.heure_fin || null, en.mode || 'presentiel', en.score ?? null, en.commentaire || null]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'entretien', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/entretiens/:id',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = entretienSchema.partial({ date_entretien: true }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const en = parsed.data;
    const statut = req.body?.statut;
    if (statut && !['planifie', 'realise', 'annule'].includes(statut)) throw badRequest('Statut invalide');
    const { rows } = await query(
      `UPDATE rh_entretiens SET
         evaluateur_id = COALESCE($2, evaluateur_id), date_entretien = COALESCE($3, date_entretien),
         heure_debut = COALESCE($4, heure_debut), heure_fin = COALESCE($5, heure_fin),
         mode = COALESCE($6, mode), score = COALESCE($7, score), commentaire = COALESCE($8, commentaire),
         statut = COALESCE($9, statut), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, en.evaluateur_id, en.date_entretien, en.heure_debut, en.heure_fin, en.mode, en.score, en.commentaire, statut || null]
    );
    if (!rows[0]) throw notFound('Entretien introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'entretien', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/entretiens/:id',
  requirePermission('rh', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM rh_entretiens WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw notFound('Entretien introuvable');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'rh', entityType: 'entretien', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

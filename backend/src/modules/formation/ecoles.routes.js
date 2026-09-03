import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { ecoleSchema, salleSchema, classeSchema } from './formation.schemas.js';

const router = Router();
router.use(requireStaff);

router.get(
  '/',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut_partenariat) {
      params.push(req.query.statut_partenariat);
      where.push(`statut_partenariat = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`(nom ILIKE $${params.length} OR ville ILIKE $${params.length})`);
    }
    const { rows } = await query(
      `SELECT * FROM formation_ecoles
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY nom ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM formation_ecoles WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('École introuvable');
    const { rows: salles } = await query(
      `SELECT s.*, COUNT(e.id) AS nb_equipements
         FROM formation_salles s
         LEFT JOIN formation_equipements e ON e.salle_id = s.id
        WHERE s.ecole_id = $1
        GROUP BY s.id
        ORDER BY s.nom ASC`,
      [req.params.id]
    );
    const { rows: classes } = await query(
      'SELECT * FROM formation_classes WHERE ecole_id = $1 ORDER BY nom ASC',
      [req.params.id]
    );
    res.json({ ...rows[0], salles, classes });
  })
);

router.post(
  '/',
  requirePermission('formation', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = ecoleSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (nom et ville requis)');
    const e = parsed.data;
    const { rows } = await query(
      `INSERT INTO formation_ecoles (nom, ville, adresse, contact_nom, contact_telephone, contact_email, date_debut_partenariat, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [e.nom, e.ville, e.adresse || null, e.contact_nom || null, e.contact_telephone || null, e.contact_email || null, e.date_debut_partenariat || null, e.notes || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'formation', entityType: 'ecole', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('formation', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = ecoleSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const e = parsed.data;
    const { rows } = await query(
      `UPDATE formation_ecoles SET
         nom = COALESCE($2, nom), ville = COALESCE($3, ville), adresse = COALESCE($4, adresse),
         contact_nom = COALESCE($5, contact_nom), contact_telephone = COALESCE($6, contact_telephone),
         contact_email = COALESCE($7, contact_email), date_debut_partenariat = COALESCE($8, date_debut_partenariat),
         notes = COALESCE($9, notes), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, e.nom, e.ville, e.adresse, e.contact_nom, e.contact_telephone, e.contact_email, e.date_debut_partenariat, e.notes]
    );
    if (!rows[0]) throw notFound('École introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'ecole', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('formation', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut_partenariat;
    if (!['actif', 'suspendu', 'termine'].includes(statut)) throw badRequest('Statut invalide');
    const { rows } = await query(
      `UPDATE formation_ecoles SET statut_partenariat = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, statut]
    );
    if (!rows[0]) throw notFound('École introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'ecole', entityId: rows[0].id, details: { statut_partenariat: statut }, ip: req.ip });
    res.json(rows[0]);
  })
);

// ---- Salles (nichées sous une école) ----

router.post(
  '/:ecoleId/salles',
  requirePermission('formation', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = salleSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (nom requis)');
    const s = parsed.data;
    const { rows: ecoleRows } = await query('SELECT id FROM formation_ecoles WHERE id = $1', [req.params.ecoleId]);
    if (!ecoleRows[0]) throw notFound('École introuvable');
    const { rows } = await query(
      `INSERT INTO formation_salles (ecole_id, nom, capacite, notes) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.ecoleId, s.nom, s.capacite ?? null, s.notes || null]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'formation', entityType: 'salle', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.get(
  '/:ecoleId/salles/:salleId',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT s.*, e.nom AS ecole_nom,
              (SELECT MAX(date_visite) FROM formation_maintenance_visites
                WHERE salle_id = s.id AND statut = 'realisee') AS derniere_visite
         FROM formation_salles s
         JOIN formation_ecoles e ON e.id = s.ecole_id
        WHERE s.id = $1 AND s.ecole_id = $2`,
      [req.params.salleId, req.params.ecoleId]
    );
    if (!rows[0]) throw notFound('Salle introuvable');
    const salle = rows[0];
    let prochaine_echeance = null;
    if (salle.frequence_maintenance_mois) {
      if (salle.derniere_visite) {
        const base = new Date(salle.derniere_visite);
        base.setMonth(base.getMonth() + salle.frequence_maintenance_mois);
        prochaine_echeance = base.toISOString().slice(0, 10);
      } else {
        prochaine_echeance = new Date().toISOString().slice(0, 10);
      }
    }
    const { rows: equipements } = await query(
      'SELECT * FROM formation_equipements WHERE salle_id = $1 ORDER BY type_equipement ASC, designation ASC',
      [req.params.salleId]
    );
    res.json({ ...salle, prochaine_echeance, equipements });
  })
);

router.patch(
  '/:ecoleId/salles/:salleId',
  requirePermission('formation', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = salleSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const s = parsed.data;
    // `frequence_maintenance_mois` doit pouvoir être explicitement remis à null (désactiver le cycle) :
    // COALESCE ne le permettrait pas (NULL envoyé = "ne pas toucher"), d'où le CASE piloté par la présence de la clé.
    const freqProvided = Object.prototype.hasOwnProperty.call(req.body, 'frequence_maintenance_mois');
    const { rows } = await query(
      `UPDATE formation_salles SET
         nom = COALESCE($3, nom), capacite = COALESCE($4, capacite), notes = COALESCE($5, notes),
         frequence_maintenance_mois = CASE WHEN $6 THEN $7 ELSE frequence_maintenance_mois END,
         updated_at = now()
       WHERE id = $1 AND ecole_id = $2 RETURNING *`,
      [req.params.salleId, req.params.ecoleId, s.nom, s.capacite, s.notes, freqProvided, s.frequence_maintenance_mois ?? null]
    );
    if (!rows[0]) throw notFound('Salle introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'salle', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:ecoleId/salles/:salleId',
  requirePermission('formation', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `DELETE FROM formation_salles WHERE id = $1 AND ecole_id = $2 RETURNING id`,
      [req.params.salleId, req.params.ecoleId]
    );
    if (!rows[0]) throw notFound('Salle introuvable');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'formation', entityType: 'salle', entityId: req.params.salleId, ip: req.ip });
    res.status(204).send();
  })
);

// ---- Classes (nichées sous une école) ----

router.post(
  '/:ecoleId/classes',
  requirePermission('formation', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = classeSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (nom requis)');
    const c = parsed.data;
    const { rows: ecoleRows } = await query('SELECT id FROM formation_ecoles WHERE id = $1', [req.params.ecoleId]);
    if (!ecoleRows[0]) throw notFound('École introuvable');
    const { rows } = await query(
      `INSERT INTO formation_classes (ecole_id, nom, notes) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.ecoleId, c.nom, c.notes || null]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'formation', entityType: 'classe', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.get(
  '/:ecoleId/classes/:classeId',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT c.*, e.nom AS ecole_nom FROM formation_classes c
         JOIN formation_ecoles e ON e.id = c.ecole_id
        WHERE c.id = $1 AND c.ecole_id = $2`,
      [req.params.classeId, req.params.ecoleId]
    );
    if (!rows[0]) throw notFound('Classe introuvable');
    res.json(rows[0]);
  })
);

router.patch(
  '/:ecoleId/classes/:classeId',
  requirePermission('formation', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = classeSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;
    const { rows } = await query(
      `UPDATE formation_classes SET nom = COALESCE($3, nom), notes = COALESCE($4, notes), updated_at = now()
       WHERE id = $1 AND ecole_id = $2 RETURNING *`,
      [req.params.classeId, req.params.ecoleId, c.nom, c.notes]
    );
    if (!rows[0]) throw notFound('Classe introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'classe', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:ecoleId/classes/:classeId',
  requirePermission('formation', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `DELETE FROM formation_classes WHERE id = $1 AND ecole_id = $2 RETURNING id`,
      [req.params.classeId, req.params.ecoleId]
    );
    if (!rows[0]) throw notFound('Classe introuvable');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'formation', entityType: 'classe', entityId: req.params.classeId, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

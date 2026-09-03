import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { campagneSchema } from './prospection.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('prospection', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`statut = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT * FROM prospection_campagnes
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY date_debut DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('prospection', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM prospection_campagnes WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Campagne introuvable');
    const { rows: groupes } = await query(
      `SELECT g.*, COUNT(DISTINCT m.employe_id) AS nb_membres, COUNT(DISTINCT e.id) AS nb_ecoles
         FROM prospection_groupes g
         LEFT JOIN prospection_groupes_membres m ON m.groupe_id = g.id
         LEFT JOIN prospection_ecoles_cibles e ON e.groupe_id = g.id
        WHERE g.campagne_id = $1
        GROUP BY g.id
        ORDER BY g.nom ASC`,
      [req.params.id]
    );
    res.json({ ...rows[0], groupes });
  })
);

router.post(
  '/',
  requirePermission('prospection', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = campagneSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (nom, année et dates requis)');
    const c = parsed.data;
    if (new Date(c.date_fin) < new Date(c.date_debut)) throw badRequest('La date de fin doit être postérieure à la date de début');
    const { rows } = await query(
      `INSERT INTO prospection_campagnes (nom, annee, date_debut, date_fin, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [c.nom, c.annee, c.date_debut, c.date_fin, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'prospection', entityType: 'campagne', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('prospection', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = campagneSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;
    const { rows } = await query(
      `UPDATE prospection_campagnes SET
         nom = COALESCE($2, nom), annee = COALESCE($3, annee),
         date_debut = COALESCE($4, date_debut), date_fin = COALESCE($5, date_fin), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, c.nom, c.annee, c.date_debut, c.date_fin]
    );
    if (!rows[0]) throw notFound('Campagne introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'prospection', entityType: 'campagne', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('prospection', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut;
    if (!['active', 'cloturee'].includes(statut)) throw badRequest('Statut invalide');
    const { rows } = await query(
      `UPDATE prospection_campagnes SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, statut]
    );
    if (!rows[0]) throw notFound('Campagne introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'prospection', entityType: 'campagne', entityId: rows[0].id, details: { statut }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

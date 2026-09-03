import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { campSchema } from './formation.schemas.js';

const router = Router();
router.use(requireStaff);

router.get(
  '/',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`statut = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT * FROM formation_camps
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY date_debut DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM formation_camps WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Camp introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('formation', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = campSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (nom, lieu et dates requis)');
    const c = parsed.data;
    if (new Date(c.date_fin) < new Date(c.date_debut)) throw badRequest('La date de fin doit être postérieure à la date de début');
    const { rows } = await query(
      `INSERT INTO formation_camps (nom, lieu, ville, date_debut, date_fin, responsable_nom, responsable_telephone, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [c.nom, c.lieu, c.ville || null, c.date_debut, c.date_fin, c.responsable_nom || null, c.responsable_telephone || null, c.notes || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'formation', entityType: 'camp', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('formation', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = campSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;
    const { rows } = await query(
      `UPDATE formation_camps SET
         nom = COALESCE($2, nom), lieu = COALESCE($3, lieu), ville = COALESCE($4, ville),
         date_debut = COALESCE($5, date_debut), date_fin = COALESCE($6, date_fin),
         responsable_nom = COALESCE($7, responsable_nom), responsable_telephone = COALESCE($8, responsable_telephone),
         notes = COALESCE($9, notes), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, c.nom, c.lieu, c.ville, c.date_debut, c.date_fin, c.responsable_nom, c.responsable_telephone, c.notes]
    );
    if (!rows[0]) throw notFound('Camp introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'camp', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('formation', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut;
    if (!['planifie', 'en_cours', 'termine', 'annule'].includes(statut)) throw badRequest('Statut invalide');
    const { rows } = await query(
      `UPDATE formation_camps SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, statut]
    );
    if (!rows[0]) throw notFound('Camp introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'camp', entityId: rows[0].id, details: { statut }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

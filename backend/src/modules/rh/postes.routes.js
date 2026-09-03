import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { posteSchema } from './rh.schemas.js';

const router = Router();
router.use(requireStaff);

router.get(
  '/',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`statut = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT p.*, (SELECT count(*) FROM rh_candidats c WHERE c.poste_id = p.id) AS nb_candidats
         FROM rh_postes p
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY p.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM rh_postes WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Poste introuvable');
    const { rows: candidats } = await query(
      'SELECT * FROM rh_candidats WHERE poste_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ ...rows[0], candidats });
  })
);

router.post(
  '/',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = posteSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (titre et type de contrat requis)');
    const p = parsed.data;
    const { rows } = await query(
      `INSERT INTO rh_postes (titre, departement, type_contrat, description, nombre_postes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [p.titre, p.departement || null, p.type_contrat, p.description || null, p.nombre_postes ?? 1, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'poste', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = posteSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const p = parsed.data;
    const { rows } = await query(
      `UPDATE rh_postes SET
         titre = COALESCE($2, titre), departement = COALESCE($3, departement),
         type_contrat = COALESCE($4, type_contrat), description = COALESCE($5, description),
         nombre_postes = COALESCE($6, nombre_postes), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, p.titre, p.departement, p.type_contrat, p.description, p.nombre_postes]
    );
    if (!rows[0]) throw notFound('Poste introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'poste', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut;
    if (!['ouvert', 'pourvu', 'annule'].includes(statut)) throw badRequest('Statut invalide');
    const { rows } = await query(
      `UPDATE rh_postes SET statut = $2, date_cloture = CASE WHEN $2 = 'ouvert' THEN NULL ELSE COALESCE(date_cloture, CURRENT_DATE) END, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, statut]
    );
    if (!rows[0]) throw notFound('Poste introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'poste', entityId: rows[0].id, details: { statut }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

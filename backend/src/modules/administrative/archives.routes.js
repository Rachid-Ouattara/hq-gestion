import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { archiveSchema } from './administrative.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('administrative', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`a.statut = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`(a.libelle ILIKE $${params.length} OR a.code ILIKE $${params.length})`);
    }
    const { rows } = await query(
      `SELECT a.*, u.full_name AS responsable_nom
         FROM administrative_archives a
         LEFT JOIN users u ON u.id = a.responsable_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY a.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('administrative', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT a.*, u.full_name AS responsable_nom
         FROM administrative_archives a LEFT JOIN users u ON u.id = a.responsable_id
        WHERE a.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Dossier introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('administrative', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = archiveSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (code et libellé requis)');
    const a = parsed.data;
    const { rows } = await query(
      `INSERT INTO administrative_archives (code, libelle, type_support, emplacement, responsable_id, observations, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [a.code, a.libelle, a.type_support || 'physique', a.emplacement || null, a.responsable_id || null, a.observations || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'administrative', entityType: 'archive', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('administrative', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = archiveSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const a = parsed.data;
    const { rows } = await query(
      `UPDATE administrative_archives SET
         code = COALESCE($2, code), libelle = COALESCE($3, libelle),
         type_support = COALESCE($4, type_support), emplacement = COALESCE($5, emplacement),
         responsable_id = COALESCE($6, responsable_id), observations = COALESCE($7, observations),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, a.code, a.libelle, a.type_support, a.emplacement, a.responsable_id, a.observations]
    );
    if (!rows[0]) throw notFound('Dossier introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'administrative', entityType: 'archive', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/cloturer',
  requirePermission('administrative', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE administrative_archives SET statut = 'clos', date_cloture = CURRENT_DATE, updated_at = now()
       WHERE id = $1 AND statut = 'ouvert' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un dossier ouvert peut être clôturé');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'administrative', entityType: 'archive', entityId: rows[0].id, details: { statut: 'clos' }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

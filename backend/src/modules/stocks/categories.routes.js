import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { categorieSchema } from './stocks.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('stocks', 'read'),
  asyncHandler(async (_req, res) => {
    const { rows } = await query('SELECT * FROM stocks_categories ORDER BY nom ASC');
    res.json(rows);
  })
);

router.post(
  '/',
  requirePermission('stocks', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = categorieSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (nom requis)');
    const c = parsed.data;
    const { rows } = await query(
      `INSERT INTO stocks_categories (nom, description) VALUES ($1,$2) RETURNING *`,
      [c.nom, c.description || null]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'stocks', entityType: 'categorie', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('stocks', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = categorieSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;
    const { rows } = await query(
      `UPDATE stocks_categories SET nom = COALESCE($2, nom), description = COALESCE($3, description), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, c.nom, c.description]
    );
    if (!rows[0]) throw notFound('Catégorie introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'stocks', entityType: 'categorie', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

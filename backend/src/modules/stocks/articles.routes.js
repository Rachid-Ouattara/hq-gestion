import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { articleSchema } from './stocks.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('stocks', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`(a.designation ILIKE $${params.length} OR a.reference ILIKE $${params.length})`);
    }
    if (req.query.categorie_id) {
      params.push(req.query.categorie_id);
      where.push(`a.categorie_id = $${params.length}`);
    }
    if (req.query.is_active !== undefined) {
      params.push(req.query.is_active === 'true');
      where.push(`a.is_active = $${params.length}`);
    }
    if (req.query.sous_seuil === 'true') {
      where.push(`a.quantite_stock <= a.seuil_alerte`);
    }
    const { rows } = await query(
      `SELECT a.*, c.nom AS categorie_nom
         FROM stocks_articles a
         LEFT JOIN stocks_categories c ON c.id = a.categorie_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY a.designation ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('stocks', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT a.*, c.nom AS categorie_nom
         FROM stocks_articles a
         LEFT JOIN stocks_categories c ON c.id = a.categorie_id
        WHERE a.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Article introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('stocks', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = articleSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (désignation requise)');
    const a = parsed.data;
    const { rows } = await query(
      `INSERT INTO stocks_articles (reference, designation, categorie_id, unite, seuil_alerte, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [a.reference || null, a.designation, a.categorie_id || null, a.unite || 'unité', a.seuil_alerte ?? 0, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'stocks', entityType: 'article', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('stocks', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = articleSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const a = parsed.data;
    const { rows } = await query(
      `UPDATE stocks_articles SET
         reference = COALESCE($2, reference),
         designation = COALESCE($3, designation),
         categorie_id = COALESCE($4, categorie_id),
         unite = COALESCE($5, unite),
         seuil_alerte = COALESCE($6, seuil_alerte),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, a.reference, a.designation, a.categorie_id, a.unite, a.seuil_alerte]
    );
    if (!rows[0]) throw notFound('Article introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'stocks', entityType: 'article', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('stocks', 'update'),
  asyncHandler(async (req, res) => {
    const active = Boolean(req.body?.is_active);
    const { rows } = await query(
      `UPDATE stocks_articles SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, active]
    );
    if (!rows[0]) throw notFound('Article introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'stocks', entityType: 'article', entityId: rows[0].id, details: { is_active: active }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { registerMovement } from './stocks.service.js';
import { mouvementSchema } from './stocks.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('stocks', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.type) {
      params.push(req.query.type);
      where.push(`m.type = $${params.length}`);
    }
    if (req.query.article_id) {
      params.push(req.query.article_id);
      where.push(`m.article_id = $${params.length}`);
    }
    if (req.query.source_type) {
      params.push(req.query.source_type);
      where.push(`m.source_type = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT m.*, a.designation AS article_designation, a.unite AS article_unite, u.full_name AS effectue_par_nom
         FROM stocks_mouvements m
         JOIN stocks_articles a ON a.id = m.article_id
         LEFT JOIN users u ON u.id = m.effectue_par
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY m.created_at DESC`,
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
      `SELECT m.*, a.designation AS article_designation, a.unite AS article_unite
         FROM stocks_mouvements m JOIN stocks_articles a ON a.id = m.article_id
        WHERE m.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Mouvement introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('stocks', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = mouvementSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (article, type, quantité > 0 et motif requis)');
    const m = parsed.data;

    const mouvement = await withTransaction((client) =>
      registerMovement(client, {
        articleId: m.article_id,
        type: m.type,
        quantite: m.quantite,
        motif: m.motif,
        sourceType: 'manuel',
        sourceId: null,
        userId: req.user.id,
        observations: m.observations || null,
      })
    );

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'stocks', entityType: 'mouvement', entityId: mouvement.id, details: { type: m.type }, ip: req.ip });
    res.status(201).json(mouvement);
  })
);

export default router;

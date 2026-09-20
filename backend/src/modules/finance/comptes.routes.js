import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { compteSchema } from './finance.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.type) {
      params.push(req.query.type);
      where.push(`type = $${params.length}`);
    }
    if (req.query.is_active !== undefined) {
      params.push(req.query.is_active === 'true');
      where.push(`is_active = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT * FROM finance_comptes
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY code ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM finance_comptes WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Compte introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('finance', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = compteSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (code, libellé et type requis)');
    const c = parsed.data;
    const { rows } = await query(
      `INSERT INTO finance_comptes (code, libelle, type, type_tresorerie, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [c.code, c.libelle, c.type, c.type_tresorerie || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'finance', entityType: 'compte', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('finance', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = compteSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;
    const { rows } = await query(
      `UPDATE finance_comptes SET
         code = COALESCE($2, code), libelle = COALESCE($3, libelle), type = COALESCE($4, type),
         type_tresorerie = COALESCE($5, type_tresorerie), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, c.code, c.libelle, c.type, c.type_tresorerie]
    );
    if (!rows[0]) throw notFound('Compte introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'finance', entityType: 'compte', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('finance', 'update'),
  asyncHandler(async (req, res) => {
    const active = Boolean(req.body?.is_active);
    const { rows } = await query(
      `UPDATE finance_comptes SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, active]
    );
    if (!rows[0]) throw notFound('Compte introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'finance', entityType: 'compte', entityId: rows[0].id, details: { is_active: active }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

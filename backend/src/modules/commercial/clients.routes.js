import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { clientSchema } from './commercial.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('commercial', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`nom ILIKE $${params.length}`);
    }
    if (req.query.is_active !== undefined) {
      params.push(req.query.is_active === 'true');
      where.push(`is_active = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT * FROM commercial_clients
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY nom ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('commercial', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM commercial_clients WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Client introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('commercial', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (nom requis)');
    const c = parsed.data;
    const { rows } = await query(
      `INSERT INTO commercial_clients (nom, contact_nom, telephone, email, adresse, numero_fiscal, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [c.nom, c.contact_nom || null, c.telephone || null, c.email || null, c.adresse || null, c.numero_fiscal || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'commercial', entityType: 'client', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('commercial', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = clientSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;
    const { rows } = await query(
      `UPDATE commercial_clients SET
         nom = COALESCE($2, nom),
         contact_nom = COALESCE($3, contact_nom),
         telephone = COALESCE($4, telephone),
         email = COALESCE($5, email),
         adresse = COALESCE($6, adresse),
         numero_fiscal = COALESCE($7, numero_fiscal),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, c.nom, c.contact_nom, c.telephone, c.email, c.adresse, c.numero_fiscal]
    );
    if (!rows[0]) throw notFound('Client introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'commercial', entityType: 'client', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('commercial', 'update'),
  asyncHandler(async (req, res) => {
    const active = Boolean(req.body?.is_active);
    const { rows } = await query(
      `UPDATE commercial_clients SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, active]
    );
    if (!rows[0]) throw notFound('Client introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'commercial', entityType: 'client', entityId: rows[0].id, details: { is_active: active }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

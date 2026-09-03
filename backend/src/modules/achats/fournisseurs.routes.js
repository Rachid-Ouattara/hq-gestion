import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { fournisseurSchema } from './achats.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('achats', 'read'),
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
      `SELECT * FROM fournisseurs
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY nom ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('achats', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM fournisseurs WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Fournisseur introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('achats', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = fournisseurSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (nom requis)');
    const f = parsed.data;
    const { rows } = await query(
      `INSERT INTO fournisseurs (nom, contact_nom, telephone, email, adresse, numero_fiscal, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [f.nom, f.contact_nom || null, f.telephone || null, f.email || null, f.adresse || null, f.numero_fiscal || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'achats', entityType: 'fournisseur', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('achats', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = fournisseurSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const f = parsed.data;
    const { rows } = await query(
      `UPDATE fournisseurs SET
         nom = COALESCE($2, nom),
         contact_nom = COALESCE($3, contact_nom),
         telephone = COALESCE($4, telephone),
         email = COALESCE($5, email),
         adresse = COALESCE($6, adresse),
         numero_fiscal = COALESCE($7, numero_fiscal),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, f.nom, f.contact_nom, f.telephone, f.email, f.adresse, f.numero_fiscal]
    );
    if (!rows[0]) throw notFound('Fournisseur introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'achats', entityType: 'fournisseur', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('achats', 'update'),
  asyncHandler(async (req, res) => {
    const active = Boolean(req.body?.is_active);
    const { rows } = await query(
      `UPDATE fournisseurs SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, active]
    );
    if (!rows[0]) throw notFound('Fournisseur introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'achats', entityType: 'fournisseur', entityId: rows[0].id, details: { is_active: active }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

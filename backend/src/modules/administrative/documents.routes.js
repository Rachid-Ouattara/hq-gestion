import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { documentSchema } from './administrative.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('administrative', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.type_document) {
      params.push(req.query.type_document);
      where.push(`d.type_document = $${params.length}`);
    }
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`d.statut = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`d.titre ILIKE $${params.length}`);
    }
    const { rows } = await query(
      `SELECT d.*, a.libelle AS archive_libelle
         FROM administrative_documents d
         LEFT JOIN administrative_archives a ON a.id = d.archive_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY d.date_document DESC, d.created_at DESC`,
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
      `SELECT d.*, a.libelle AS archive_libelle
         FROM administrative_documents d LEFT JOIN administrative_archives a ON a.id = d.archive_id
        WHERE d.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Document introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('administrative', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = documentSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (type et titre requis)');
    const d = parsed.data;
    const { rows } = await query(
      `INSERT INTO administrative_documents (type_document, titre, description, date_document, date_expiration, created_by)
       VALUES ($1,$2,$3,COALESCE($4, CURRENT_DATE),$5,$6)
       RETURNING *`,
      [d.type_document, d.titre, d.description || null, d.date_document || null, d.date_expiration || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'administrative', entityType: 'document', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('administrative', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = documentSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const d = parsed.data;
    const { rows } = await query(
      `UPDATE administrative_documents SET
         type_document = COALESCE($2, type_document), titre = COALESCE($3, titre),
         description = COALESCE($4, description), date_document = COALESCE($5, date_document),
         date_expiration = COALESCE($6, date_expiration), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, d.type_document, d.titre, d.description, d.date_document, d.date_expiration]
    );
    if (!rows[0]) throw notFound('Document introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'administrative', entityType: 'document', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/archiver',
  requirePermission('administrative', 'update'),
  asyncHandler(async (req, res) => {
    const archiveId = req.body?.archive_id;
    if (!archiveId) throw badRequest('archive_id requis');
    const { rows } = await query(
      `UPDATE administrative_documents SET statut = 'archive', archive_id = $2, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, archiveId]
    );
    if (!rows[0]) throw notFound('Document introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'administrative', entityType: 'document', entityId: rows[0].id, details: { statut: 'archive' }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

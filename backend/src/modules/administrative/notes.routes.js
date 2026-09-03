import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { noteSchema } from './administrative.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('administrative', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`statut = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`objet ILIKE $${params.length}`);
    }
    const { rows } = await query(
      `SELECT * FROM administrative_notes
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('administrative', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM administrative_notes WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Note introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('administrative', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (objet et contenu requis)');
    const n = parsed.data;
    const { rows } = await query(
      `INSERT INTO administrative_notes (objet, contenu, destinataires, date_note, created_by)
       VALUES ($1,$2,$3,COALESCE($4, CURRENT_DATE),$5)
       RETURNING *`,
      [n.objet, n.contenu, n.destinataires || null, n.date_note || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'administrative', entityType: 'note', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('administrative', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = noteSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const n = parsed.data;
    const { rows } = await query(
      `UPDATE administrative_notes SET
         objet = COALESCE($2, objet), contenu = COALESCE($3, contenu),
         destinataires = COALESCE($4, destinataires), date_note = COALESCE($5, date_note), updated_at = now()
       WHERE id = $1 AND statut = 'brouillon' RETURNING *`,
      [req.params.id, n.objet, n.contenu, n.destinataires, n.date_note]
    );
    if (!rows[0]) throw badRequest("Seule une note en brouillon peut être modifiée");
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'administrative', entityType: 'note', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/diffuser',
  requirePermission('administrative', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE administrative_notes SET statut = 'diffusee', updated_at = now()
       WHERE id = $1 AND statut = 'brouillon' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seule une note en brouillon peut être diffusée');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'administrative', entityType: 'note', entityId: rows[0].id, details: { statut: 'diffusee' }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

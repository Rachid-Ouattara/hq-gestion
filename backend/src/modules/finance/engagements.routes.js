import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { engagementSchema } from './finance.schemas.js';

const router = Router();

// Liste légère des utilisateurs actifs pour le champ « Responsable » —
// /api/users est réservé à l'admin (gestion des comptes), alors que
// désigner un responsable de suivi doit rester accessible à quiconque a
// le droit finance:read (ex. secrétaire).
router.get(
  '/responsables',
  requirePermission('finance', 'read'),
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`SELECT id, full_name FROM users WHERE is_active = true ORDER BY full_name ASC`);
    res.json(rows);
  })
);

router.get(
  '/',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`e.statut = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT e.*, u.full_name AS responsable_nom
         FROM finance_engagements e
         LEFT JOIN users u ON u.id = e.responsable_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY e.echeance ASC NULLS LAST, e.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.post(
  '/',
  requirePermission('finance', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = engagementSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (libellé et montant > 0 requis)');
    const e = parsed.data;
    const { rows } = await query(
      `INSERT INTO finance_engagements (libelle, montant, date_engagement, echeance, responsable_id, notes, created_by)
       VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5,$6,$7)
       RETURNING *`,
      [e.libelle, e.montant, e.date_engagement || null, e.echeance || null, e.responsable_id || null, e.notes || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'finance', entityType: 'engagement', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('finance', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut;
    if (!['a_payer', 'en_cours', 'solde'].includes(statut)) throw badRequest('Statut invalide');
    const { rows } = await query(
      `UPDATE finance_engagements SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, statut]
    );
    if (!rows[0]) throw notFound('Engagement introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'finance', entityType: 'engagement', entityId: rows[0].id, details: { statut }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { adjustCompteSolde } from './finance.service.js';
import { recetteSchema } from './finance.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.compte_id) {
      params.push(req.query.compte_id);
      where.push(`r.compte_id = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`r.date_recette >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`r.date_recette <= $${params.length}`);
    }
    const { rows } = await query(
      `SELECT r.*, c.code AS compte_code, c.libelle AS compte_libelle
         FROM finance_recettes r JOIN finance_comptes c ON c.id = r.compte_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY r.date_recette DESC, r.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT r.*, c.code AS compte_code, c.libelle AS compte_libelle
         FROM finance_recettes r JOIN finance_comptes c ON c.id = r.compte_id
        WHERE r.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Recette introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('finance', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = recetteSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (compte, source et montant > 0 requis)');
    const r = parsed.data;

    const recette = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO finance_recettes (compte_id, date_recette, source, montant, reference, activite, created_by)
         VALUES ($1,COALESCE($2, CURRENT_DATE),$3,$4,$5,$6,$7)
         RETURNING *`,
        [r.compte_id, r.date_recette || null, r.source, r.montant, r.reference || null, r.activite, req.user.id]
      );
      await adjustCompteSolde(client, { compteId: r.compte_id, delta: r.montant });
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'finance', entityType: 'recette', entityId: recette.id, ip: req.ip });
    res.status(201).json(recette);
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { adjustCompteSolde } from './finance.service.js';
import { depenseSchema } from './finance.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.compte_id) {
      params.push(req.query.compte_id);
      where.push(`d.compte_id = $${params.length}`);
    }
    if (req.query.budget_id) {
      params.push(req.query.budget_id);
      where.push(`d.budget_id = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`d.date_depense >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`d.date_depense <= $${params.length}`);
    }
    const { rows } = await query(
      `SELECT d.*, c.code AS compte_code, c.libelle AS compte_libelle, b.numero AS budget_numero
         FROM finance_depenses d
         JOIN finance_comptes c ON c.id = d.compte_id
         LEFT JOIN finance_budgets b ON b.id = d.budget_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY d.date_depense DESC, d.created_at DESC`,
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
      `SELECT d.*, c.code AS compte_code, c.libelle AS compte_libelle
         FROM finance_depenses d JOIN finance_comptes c ON c.id = d.compte_id
        WHERE d.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Dépense introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('finance', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = depenseSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (compte, catégorie, libellé et montant > 0 requis)');
    const d = parsed.data;

    const depense = await withTransaction(async (client) => {
      if (d.budget_id) {
        const { rows: budgetRows } = await client.query('SELECT id FROM finance_budgets WHERE id = $1', [d.budget_id]);
        if (!budgetRows[0]) throw badRequest('Budget introuvable');
      }
      const { rows } = await client.query(
        `INSERT INTO finance_depenses (compte_id, budget_id, date_depense, categorie, libelle, montant, reference, created_by)
         VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5,$6,$7,$8)
         RETURNING *`,
        [d.compte_id, d.budget_id || null, d.date_depense || null, d.categorie, d.libelle, d.montant, d.reference || null, req.user.id]
      );
      await adjustCompteSolde(client, { compteId: d.compte_id, delta: -d.montant });
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'finance', entityType: 'depense', entityId: depense.id, ip: req.ip });
    res.status(201).json(depense);
  })
);

export default router;

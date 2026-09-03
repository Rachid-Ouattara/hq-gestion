import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { budgetSchema } from './finance.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.exercice) {
      params.push(req.query.exercice);
      where.push(`b.exercice = $${params.length}`);
    }
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`b.statut = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT b.*, COALESCE(SUM(d.montant), 0) AS montant_realise
         FROM finance_budgets b
         LEFT JOIN finance_depenses d ON d.budget_id = b.id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        GROUP BY b.id
        ORDER BY b.exercice DESC, b.libelle ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM finance_budgets WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Budget introuvable');
    const { rows: depenseRows } = await query(
      `SELECT d.*, c.libelle AS compte_libelle
         FROM finance_depenses d JOIN finance_comptes c ON c.id = d.compte_id
        WHERE d.budget_id = $1
        ORDER BY d.date_depense DESC`,
      [req.params.id]
    );
    const montantRealise = depenseRows.reduce((sum, d) => sum + Number(d.montant), 0);
    const montantPrevu = Number(rows[0].montant_prevu);
    res.json({
      ...rows[0],
      depenses: depenseRows,
      montant_realise: montantRealise,
      taux_consommation: montantPrevu > 0 ? montantRealise / montantPrevu : 0,
    });
  })
);

router.post(
  '/',
  requirePermission('finance', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = budgetSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (exercice et libellé requis)');
    const b = parsed.data;
    const { rows } = await query(
      `INSERT INTO finance_budgets (exercice, libelle, departement, montant_prevu, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [b.exercice, b.libelle, b.departement || null, b.montant_prevu ?? 0, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'finance', entityType: 'budget', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('finance', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = budgetSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const b = parsed.data;
    const { rows } = await query(
      `UPDATE finance_budgets SET
         exercice = COALESCE($2, exercice), libelle = COALESCE($3, libelle),
         departement = COALESCE($4, departement), montant_prevu = COALESCE($5, montant_prevu), updated_at = now()
       WHERE id = $1 AND statut = 'actif' RETURNING *`,
      [req.params.id, b.exercice, b.libelle, b.departement, b.montant_prevu]
    );
    if (!rows[0]) throw badRequest('Seul un budget actif peut être modifié');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'finance', entityType: 'budget', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/cloturer',
  requirePermission('finance', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE finance_budgets SET statut = 'cloture', updated_at = now()
       WHERE id = $1 AND statut = 'actif' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un budget actif peut être clôturé');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'finance', entityType: 'budget', entityId: rows[0].id, details: { statut: 'cloture' }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

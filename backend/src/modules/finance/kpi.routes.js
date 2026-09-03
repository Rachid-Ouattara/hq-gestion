import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();

router.get(
  '/',
  requirePermission('finance', 'read'),
  asyncHandler(async (_req, res) => {
    const [{ rows: solde }, { rows: depenses }, { rows: recettes }, { rows: budgets }] = await Promise.all([
      query('SELECT COALESCE(SUM(solde),0) AS n FROM finance_comptes WHERE is_active = true'),
      query(
        `SELECT COALESCE(SUM(montant),0) AS n FROM finance_depenses
          WHERE date_depense >= date_trunc('month', CURRENT_DATE)`
      ),
      query(
        `SELECT COALESCE(SUM(montant),0) AS n FROM finance_recettes
          WHERE date_recette >= date_trunc('month', CURRENT_DATE)`
      ),
      query("SELECT count(*)::int AS n FROM finance_budgets WHERE statut = 'actif'"),
    ]);
    res.json({
      solde_total: solde[0].n,
      depenses_mois: depenses[0].n,
      recettes_mois: recettes[0].n,
      budgets_actifs: budgets[0].n,
    });
  })
);

export default router;

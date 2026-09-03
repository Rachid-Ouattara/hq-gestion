import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();

router.get(
  '/synthese',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const annee = req.query.annee || String(new Date().getFullYear());

    const [
      { rows: recettesTotal },
      { rows: depensesTotal },
      { rows: comptes },
      { rows: budgets },
    ] = await Promise.all([
      query("SELECT COALESCE(SUM(montant), 0) AS total FROM finance_recettes WHERE to_char(date_recette, 'YYYY') = $1", [annee]),
      query("SELECT COALESCE(SUM(montant), 0) AS total FROM finance_depenses WHERE to_char(date_depense, 'YYYY') = $1", [annee]),
      query(`SELECT id, code, libelle, type, solde FROM finance_comptes WHERE is_active ORDER BY code ASC`),
      query(
        `SELECT b.id, b.numero, b.libelle, b.exercice, b.montant_prevu, b.statut,
                COALESCE(SUM(d.montant), 0) AS montant_realise
           FROM finance_budgets b
           LEFT JOIN finance_depenses d ON d.budget_id = b.id
          WHERE b.exercice = $1
          GROUP BY b.id
          ORDER BY b.libelle ASC`,
        [annee]
      ),
    ]);

    const totalRecettes = Number(recettesTotal[0].total);
    const totalDepenses = Number(depensesTotal[0].total);

    res.json({
      annee,
      total_recettes: totalRecettes,
      total_depenses: totalDepenses,
      solde_net: totalRecettes - totalDepenses,
      comptes,
      budgets,
    });
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();

router.get(
  '/',
  requirePermission('finance', 'read'),
  asyncHandler(async (_req, res) => {
    const [{ rows: solde }, { rows: depenses }, { rows: recettes }, { rows: budgets }, { rows: creances }, { rows: dettes }] = await Promise.all([
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
      query(
        `SELECT COALESCE(SUM(f.montant_total - COALESCE(enc.total_encaisse, 0)), 0) AS n
           FROM commercial_factures f
           LEFT JOIN (SELECT facture_id, SUM(montant) AS total_encaisse FROM commercial_encaissements GROUP BY facture_id) enc
             ON enc.facture_id = f.id
          WHERE f.statut != 'annulee'`
      ),
      query(
        `SELECT COALESCE(SUM(b.montant_total - COALESCE(pai.total_paye, 0)), 0) AS n
           FROM bons_de_commande b
           LEFT JOIN (SELECT bon_id, SUM(montant) AS total_paye FROM paiements GROUP BY bon_id) pai
             ON pai.bon_id = b.id
          WHERE b.statut != 'annule'`
      ),
    ]);
    res.json({
      solde_total: solde[0].n,
      depenses_mois: depenses[0].n,
      recettes_mois: recettes[0].n,
      budgets_actifs: budgets[0].n,
      creances_a_recouvrer: creances[0].n,
      dettes_a_payer: dettes[0].n,
      resultat_mois: Number(recettes[0].n) - Number(depenses[0].n),
    });
  })
);

export default router;

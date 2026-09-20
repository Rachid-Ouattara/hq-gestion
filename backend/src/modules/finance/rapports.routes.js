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
      { rows: produitsParActivite },
      { rows: chargesParNature },
      { rows: chargesDirectesParActivite },
      { rows: previsionAnnee },
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
      query(
        `SELECT activite, COALESCE(SUM(montant), 0) AS total FROM finance_recettes
          WHERE to_char(date_recette, 'YYYY') = $1 GROUP BY activite`,
        [annee]
      ),
      query(
        `SELECT categorie, COALESCE(SUM(montant), 0) AS total FROM finance_depenses
          WHERE to_char(date_depense, 'YYYY') = $1 GROUP BY categorie`,
        [annee]
      ),
      query(
        `SELECT activite, COALESCE(SUM(montant), 0) AS total FROM finance_depenses
          WHERE to_char(date_depense, 'YYYY') = $1 AND activite IS NOT NULL GROUP BY activite`,
        [annee]
      ),
      query(`SELECT COALESCE(SUM(montant_prevu), 0) AS total FROM finance_previsions_recettes WHERE exercice = $1`, [annee]),
    ]);

    const totalRecettes = Number(recettesTotal[0].total);
    const totalDepenses = Number(depensesTotal[0].total);
    const totalPrevu = Number(previsionAnnee[0].total);

    const chargesDirectesByActivite = Object.fromEntries(chargesDirectesParActivite.map((c) => [c.activite, Number(c.total)]));
    const analyseParActivite = produitsParActivite.map((p) => {
      const ca = Number(p.total);
      const chargesDirectes = chargesDirectesByActivite[p.activite] || 0;
      return { activite: p.activite, ca, charges_directes: chargesDirectes, marge: ca - chargesDirectes };
    });

    res.json({
      annee,
      total_recettes: totalRecettes,
      total_depenses: totalDepenses,
      solde_net: totalRecettes - totalDepenses,
      comptes,
      budgets,
      resultat: {
        produits_par_activite: produitsParActivite.map((r) => ({ activite: r.activite, montant: Number(r.total) })),
        charges_par_nature: chargesParNature.map((r) => ({ categorie: r.categorie, montant: Number(r.total) })),
        total_produits: totalRecettes,
        total_charges: totalDepenses,
        resultat: totalRecettes - totalDepenses,
        prevu: totalPrevu,
        ecart: totalRecettes - totalPrevu,
        ecart_pct: totalPrevu > 0 ? (totalRecettes - totalPrevu) / totalPrevu : null,
      },
      analyse_par_activite: analyseParActivite,
    });
  })
);

export default router;

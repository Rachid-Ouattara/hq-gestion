import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();

// Comptes de trésorerie (Banque/Caisse/Mobile Money) — le solde est déjà
// maintenu par adjustCompteSolde (finance.service.js) à chaque recette,
// dépense ou encaissement commercial lié à un compte : rien à recalculer ici.
router.get(
  '/',
  requirePermission('finance', 'read'),
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT id, code, libelle, type_tresorerie, solde
         FROM finance_comptes
        WHERE is_active = true AND type_tresorerie IS NOT NULL
        ORDER BY type_tresorerie ASC, code ASC`
    );
    const parType = {};
    for (const c of rows) {
      parType[c.type_tresorerie] = (parType[c.type_tresorerie] || 0) + Number(c.solde);
    }
    const soldeTotal = rows.reduce((sum, c) => sum + Number(c.solde), 0);
    res.json({ comptes: rows, solde_par_type: parType, solde_total: soldeTotal });
  })
);

// Mouvements (recettes/dépenses) sur les comptes de trésorerie, pour la
// période demandée — sert à afficher encaissements/décaissements et à
// dériver le solde initial (solde actuel moins la somme des mouvements
// depuis la date de début, jamais stocké — même logique que
// formateur_en_conge du chantier RH précédent).
router.get(
  '/mouvements',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const from = req.query.from || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const { rows } = await query(
      `SELECT r.id, r.date_recette AS date_mouvement, 'encaissement' AS type, r.montant, r.source AS libelle, r.compte_id
         FROM finance_recettes r JOIN finance_comptes c ON c.id = r.compte_id
        WHERE c.type_tresorerie IS NOT NULL AND r.date_recette BETWEEN $1 AND $2
       UNION ALL
       SELECT d.id, d.date_depense AS date_mouvement, 'decaissement' AS type, d.montant, d.libelle, d.compte_id
         FROM finance_depenses d JOIN finance_comptes c ON c.id = d.compte_id
        WHERE c.type_tresorerie IS NOT NULL AND d.date_depense BETWEEN $1 AND $2
        ORDER BY date_mouvement ASC`,
      [from, to]
    );
    res.json(rows);
  })
);

// Prévisionnel de trésorerie : solde actuel des comptes de trésorerie +
// créances à échoir (factures non soldées, échéance <= aujourd'hui+N) -
// dettes à échoir (bons de commande non soldés, échéance <= aujourd'hui+N).
// Limite assumée : pas de modélisation des charges récurrentes, seulement
// les échéances déjà connues des tiers.
router.get(
  '/previsionnel',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const jours = [30, 60, 90].includes(Number(req.query.jours)) ? Number(req.query.jours) : 30;

    const [{ rows: soldeRows }, { rows: creanceRows }, { rows: detteRows }] = await Promise.all([
      query(`SELECT COALESCE(SUM(solde), 0) AS n FROM finance_comptes WHERE is_active = true AND type_tresorerie IS NOT NULL`),
      query(
        `SELECT COALESCE(SUM(f.montant_total - COALESCE(enc.total_encaisse, 0)), 0) AS n
           FROM commercial_factures f
           LEFT JOIN (SELECT facture_id, SUM(montant) AS total_encaisse FROM commercial_encaissements GROUP BY facture_id) enc
             ON enc.facture_id = f.id
          WHERE f.statut != 'annulee' AND f.echeance IS NOT NULL AND f.echeance <= CURRENT_DATE + $1::int
            AND f.montant_total - COALESCE(enc.total_encaisse, 0) > 0`,
        [jours]
      ),
      query(
        `SELECT COALESCE(SUM(b.montant_total - COALESCE(pai.total_paye, 0)), 0) AS n
           FROM bons_de_commande b
           LEFT JOIN (SELECT bon_id, SUM(montant) AS total_paye FROM paiements GROUP BY bon_id) pai
             ON pai.bon_id = b.id
          WHERE b.statut != 'annule' AND b.echeance IS NOT NULL AND b.echeance <= CURRENT_DATE + $1::int
            AND b.montant_total - COALESCE(pai.total_paye, 0) > 0`,
        [jours]
      ),
    ]);

    const soldeActuel = Number(soldeRows[0].n);
    const creancesAEchoir = Number(creanceRows[0].n);
    const dettesAEchoir = Number(detteRows[0].n);

    res.json({
      jours,
      solde_actuel: soldeActuel,
      creances_a_echoir: creancesAEchoir,
      dettes_a_echoir: dettesAEchoir,
      solde_previsionnel: soldeActuel + creancesAEchoir - dettesAEchoir,
    });
  })
);

export default router;

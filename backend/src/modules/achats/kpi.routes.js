import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();

router.get(
  '/',
  requirePermission('achats', 'read'),
  asyncHandler(async (_req, res) => {
    const [{ rows: demandes }, { rows: bons }, { rows: montant }, { rows: fournisseurs }] = await Promise.all([
      query("SELECT count(*)::int AS n FROM demandes_achat WHERE statut = 'soumise'"),
      query("SELECT count(*)::int AS n FROM bons_de_commande WHERE statut IN ('envoyee','receptionnee_partielle')"),
      query(
        `SELECT COALESCE(SUM(montant_total),0) AS n FROM bons_de_commande
          WHERE statut != 'annule' AND date_commande >= date_trunc('month', CURRENT_DATE)`
      ),
      query('SELECT count(*)::int AS n FROM fournisseurs WHERE is_active = true'),
    ]);
    res.json({
      demandes_en_attente: demandes[0].n,
      bons_en_cours: bons[0].n,
      montant_commande_mois: montant[0].n,
      fournisseurs_actifs: fournisseurs[0].n,
    });
  })
);

export default router;

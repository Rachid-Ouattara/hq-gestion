import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();

router.get(
  '/',
  requirePermission('commercial', 'read'),
  asyncHandler(async (_req, res) => {
    const [{ rows: devis }, { rows: commandes }, { rows: factures }, { rows: encaisse }] = await Promise.all([
      query("SELECT count(*)::int AS n FROM commercial_devis WHERE statut = 'envoye'"),
      query("SELECT count(*)::int AS n FROM commercial_commandes WHERE statut IN ('confirmee','livree')"),
      query("SELECT count(*)::int AS n FROM commercial_factures WHERE statut IN ('emise','partiellement_payee')"),
      query(
        `SELECT COALESCE(SUM(montant),0) AS n FROM commercial_encaissements
          WHERE date_encaissement >= date_trunc('month', CURRENT_DATE)`
      ),
    ]);
    res.json({
      devis_en_attente: devis[0].n,
      commandes_en_cours: commandes[0].n,
      factures_impayees: factures[0].n,
      encaisse_mois: encaisse[0].n,
    });
  })
);

export default router;

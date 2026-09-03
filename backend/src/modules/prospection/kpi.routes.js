import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const STATUTS = ['a_contacter', 'contacte', 'interesse', 'en_negociation', 'partenaire', 'refuse', 'abandonne'];
const router = Router();

router.get(
  '/',
  requirePermission('prospection', 'read'),
  asyncHandler(async (_req, res) => {
    const [{ rows: campagnes }, { rows: relances }, { rows: converties }, { rows: rapports }, { rows: parStatutRows }] = await Promise.all([
      query("SELECT count(*)::int AS n FROM prospection_campagnes WHERE statut = 'active'"),
      query(
        `SELECT count(*)::int AS n FROM prospection_ecoles_cibles
          WHERE date_relance IS NOT NULL AND date_relance <= CURRENT_DATE
            AND statut NOT IN ('partenaire','refuse','abandonne')`
      ),
      query("SELECT count(*)::int AS n FROM prospection_ecoles_cibles WHERE statut = 'partenaire'"),
      query(
        `SELECT count(*)::int AS n FROM prospection_rapports
          WHERE date_contact >= date_trunc('month', CURRENT_DATE)`
      ),
      query('SELECT statut, count(*)::int AS n FROM prospection_ecoles_cibles GROUP BY statut'),
    ]);
    const parStatut = Object.fromEntries(STATUTS.map((s) => [s, 0]));
    for (const row of parStatutRows) parStatut[row.statut] = row.n;
    res.json({
      campagnes_actives: campagnes[0].n,
      relances_en_retard: relances[0].n,
      ecoles_converties: converties[0].n,
      rapports_mois: rapports[0].n,
      par_statut: parStatut,
    });
  })
);

export default router;

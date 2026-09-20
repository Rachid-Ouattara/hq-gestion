import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();

// Agrège commercial_factures + commercial_encaissements — le module qui
// agrège gate seul l'accès (précédent posé par reporting.routes.js), pas
// besoin du droit read sur commercial en plus de finance.
router.get(
  '/',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [`f.statut != 'annulee'`];
    if (req.query.retard === 'true') {
      where.push(`f.echeance < CURRENT_DATE`);
    }
    const { rows } = await query(
      `SELECT f.id, f.numero, f.date_facture, f.echeance, f.statut, f.montant_total,
              c.id AS client_id, c.nom AS client_nom,
              COALESCE(enc.total_encaisse, 0) AS total_encaisse,
              f.montant_total - COALESCE(enc.total_encaisse, 0) AS reste_a_recouvrer,
              CASE WHEN f.echeance IS NOT NULL AND f.echeance < CURRENT_DATE
                        AND f.montant_total - COALESCE(enc.total_encaisse, 0) > 0
                   THEN (CURRENT_DATE - f.echeance)::int ELSE 0 END AS jours_retard
         FROM commercial_factures f
         JOIN commercial_clients c ON c.id = f.client_id
         LEFT JOIN (
           SELECT facture_id, SUM(montant) AS total_encaisse FROM commercial_encaissements GROUP BY facture_id
         ) enc ON enc.facture_id = f.id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY f.echeance ASC NULLS LAST, f.date_facture DESC`,
      params
    );
    res.json(rows);
  })
);

export default router;

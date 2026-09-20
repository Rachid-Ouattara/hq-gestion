import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();

// Agrège bons_de_commande + paiements — même précédent que creances.routes.js :
// finance:read gate seul, pas besoin du droit read sur achats en plus.
router.get(
  '/',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [`b.statut != 'annule'`];
    if (req.query.retard === 'true') {
      where.push(`b.echeance < CURRENT_DATE`);
    }
    const { rows } = await query(
      `SELECT b.id, b.numero, b.date_commande, b.echeance, b.statut, b.montant_total,
              f.id AS fournisseur_id, f.nom AS fournisseur_nom,
              COALESCE(pai.total_paye, 0) AS total_paye,
              b.montant_total - COALESCE(pai.total_paye, 0) AS reste_a_payer,
              CASE WHEN b.echeance IS NOT NULL AND b.echeance < CURRENT_DATE
                        AND b.montant_total - COALESCE(pai.total_paye, 0) > 0
                   THEN (CURRENT_DATE - b.echeance)::int ELSE 0 END AS jours_retard
         FROM bons_de_commande b
         JOIN fournisseurs f ON f.id = b.fournisseur_id
         LEFT JOIN (
           SELECT bon_id, SUM(montant) AS total_paye FROM paiements GROUP BY bon_id
         ) pai ON pai.bon_id = b.id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY b.echeance ASC NULLS LAST, b.date_commande DESC`,
      params
    );
    res.json(rows);
  })
);

export default router;

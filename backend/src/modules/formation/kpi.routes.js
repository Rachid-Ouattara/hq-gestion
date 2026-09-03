import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();

router.get(
  '/',
  requirePermission('formation', 'read'),
  asyncHandler(async (_req, res) => {
    const [{ rows: seances }, { rows: rapports }, { rows: maintenance }, { rows: ecoles }] = await Promise.all([
      query("SELECT count(*)::int AS n FROM formation_seances WHERE statut = 'planifiee' AND date_seance >= CURRENT_DATE"),
      query("SELECT count(*)::int AS n FROM formation_rapports_cours WHERE statut = 'soumis'"),
      query(
        `SELECT count(*)::int AS n FROM (
           SELECT s.id,
                  COALESCE(
                    MAX(v.date_visite) FILTER (WHERE v.statut = 'realisee') + (s.frequence_maintenance_mois || ' months')::interval,
                    CURRENT_DATE
                  )::date AS prochaine_echeance
             FROM formation_salles s
             LEFT JOIN formation_maintenance_visites v ON v.salle_id = s.id
            WHERE s.frequence_maintenance_mois IS NOT NULL
            GROUP BY s.id, s.frequence_maintenance_mois
         ) t WHERE prochaine_echeance <= CURRENT_DATE`
      ),
      query("SELECT count(*)::int AS n FROM formation_ecoles WHERE statut_partenariat = 'actif'"),
    ]);
    res.json({
      seances_a_venir: seances[0].n,
      rapports_a_lire: rapports[0].n,
      salles_maintenance_en_retard: maintenance[0].n,
      ecoles_actives: ecoles[0].n,
    });
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { previsionRecetteSchema } from './finance.schemas.js';

const router = Router();

// Prévu (saisi manuellement) + réalisé (agrégé depuis finance_recettes) pour
// le même exercice/mois/activité — écart et taux calculés en SQL pour éviter
// tout calcul dupliqué côté frontend.
router.get(
  '/',
  requirePermission('finance', 'read'),
  asyncHandler(async (req, res) => {
    const exercice = req.query.exercice || String(new Date().getFullYear());
    const { rows } = await query(
      `SELECT p.id, p.exercice, p.mois, p.activite, p.montant_prevu,
              COALESCE(r.montant_realise, 0) AS montant_realise,
              COALESCE(r.montant_realise, 0) - p.montant_prevu AS ecart_fcfa,
              CASE WHEN p.montant_prevu > 0
                   THEN (COALESCE(r.montant_realise, 0) - p.montant_prevu) / p.montant_prevu
                   ELSE NULL END AS ecart_pct,
              CASE WHEN p.montant_prevu > 0
                   THEN COALESCE(r.montant_realise, 0) / p.montant_prevu
                   ELSE NULL END AS taux_realisation
         FROM finance_previsions_recettes p
         LEFT JOIN (
           SELECT activite, EXTRACT(YEAR FROM date_recette)::text AS exercice, EXTRACT(MONTH FROM date_recette)::int AS mois,
                  SUM(montant) AS montant_realise
             FROM finance_recettes
            GROUP BY activite, EXTRACT(YEAR FROM date_recette), EXTRACT(MONTH FROM date_recette)
         ) r ON r.activite = p.activite AND r.exercice = p.exercice AND r.mois = p.mois
        WHERE p.exercice = $1
        ORDER BY p.mois ASC, p.activite ASC`,
      [exercice]
    );
    res.json(rows);
  })
);

router.post(
  '/',
  requirePermission('finance', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = previsionRecetteSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (exercice, mois, activité et montant prévu requis)');
    const p = parsed.data;
    const { rows } = await query(
      `INSERT INTO finance_previsions_recettes (exercice, mois, activite, montant_prevu, created_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (exercice, mois, activite) DO UPDATE SET montant_prevu = EXCLUDED.montant_prevu, updated_at = now()
       RETURNING *, (xmax = 0) AS inserted`,
      [p.exercice, p.mois, p.activite, p.montant_prevu, req.user.id]
    );
    const { inserted, ...prevision } = rows[0];
    await logAudit({ userId: req.user.id, action: inserted ? 'create' : 'update', moduleCode: 'finance', entityType: 'prevision_recette', entityId: prevision.id, ip: req.ip });
    res.status(inserted ? 201 : 200).json(prevision);
  })
);

router.patch(
  '/:id',
  requirePermission('finance', 'update'),
  asyncHandler(async (req, res) => {
    const montant = Number(req.body?.montant_prevu);
    if (!Number.isFinite(montant) || montant < 0) throw badRequest('Montant prévu invalide');
    const { rows } = await query(
      `UPDATE finance_previsions_recettes SET montant_prevu = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, montant]
    );
    if (!rows[0]) throw notFound('Prévision introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'finance', entityType: 'prevision_recette', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();
router.use(requireStaff);

router.get(
  '/',
  requirePermission('rh', 'read'),
  asyncHandler(async (_req, res) => {
    const [{ rows: employes }, { rows: conges }, { rows: evaluations }, { rows: paies }, { rows: contrats }, { rows: candidats }] = await Promise.all([
      query("SELECT count(*)::int AS n FROM rh_employes WHERE statut = 'actif'"),
      query("SELECT count(*)::int AS n FROM rh_conges WHERE statut = 'soumise'"),
      query("SELECT count(*)::int AS n FROM rh_evaluations WHERE statut = 'brouillon'"),
      query("SELECT count(*)::int AS n FROM rh_paies WHERE statut = 'brouillon'"),
      query("SELECT count(*)::int AS n FROM rh_contrats WHERE statut='actif' AND date_fin IS NOT NULL AND date_fin <= CURRENT_DATE + INTERVAL '30 days'"),
      query("SELECT count(*)::int AS n FROM rh_candidats WHERE statut NOT IN ('embauche','refuse')"),
    ]);
    res.json({
      employes_actifs: employes[0].n,
      conges_en_attente: conges[0].n,
      evaluations_brouillon: evaluations[0].n,
      paies_a_traiter: paies[0].n,
      contrats_a_renouveler: contrats[0].n,
      candidats_en_cours: candidats[0].n,
    });
  })
);

router.get(
  '/a-traiter',
  requirePermission('rh', 'read'),
  asyncHandler(async (_req, res) => {
    const [{ rows: contrats }, { rows: entretiens }, { rows: checklists }, { rows: conges }] = await Promise.all([
      query(`SELECT c.id, c.numero, c.date_fin, c.employe_id, e.nom AS employe_nom, e.prenom AS employe_prenom
               FROM rh_contrats c JOIN rh_employes e ON e.id = c.employe_id
              WHERE c.statut='actif' AND c.date_fin IS NOT NULL AND c.date_fin <= CURRENT_DATE + INTERVAL '30 days'
              ORDER BY c.date_fin ASC LIMIT 5`),
      query(`SELECT en.id, en.date_entretien, en.heure_debut, ca.id AS candidat_id, ca.nom, ca.prenom, p.titre AS poste_titre
               FROM rh_entretiens en JOIN rh_candidats ca ON ca.id = en.candidat_id JOIN rh_postes p ON p.id = ca.poste_id
              WHERE en.statut='planifie' AND en.date_entretien >= CURRENT_DATE
              ORDER BY en.date_entretien ASC, en.heure_debut ASC LIMIT 5`),
      query(`SELECT e.id AS employe_id, e.nom, e.prenom, ci.type, count(*) FILTER (WHERE NOT ci.checked)::int AS restantes
               FROM rh_checklist_items ci JOIN rh_employes e ON e.id = ci.employe_id
              GROUP BY e.id, e.nom, e.prenom, ci.type HAVING count(*) FILTER (WHERE NOT ci.checked) > 0
              ORDER BY restantes DESC LIMIT 5`),
      query(`SELECT c.id, c.numero, c.date_debut, e.nom, e.prenom
               FROM rh_conges c JOIN rh_employes e ON e.id = c.employe_id
              WHERE c.statut='soumise' ORDER BY c.created_at ASC LIMIT 5`),
    ]);
    res.json({ contrats, entretiens, checklists, conges });
  })
);

export default router;

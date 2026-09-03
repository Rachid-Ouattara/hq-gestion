import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();

router.get(
  '/',
  requirePermission('administrative', 'read'),
  asyncHandler(async (_req, res) => {
    const [{ rows: courriers }, { rows: rdv }, { rows: dossiers }, { rows: documents }] = await Promise.all([
      query("SELECT count(*)::int AS n FROM administrative_courrier WHERE statut IN ('nouveau','en_traitement')"),
      query("SELECT count(*)::int AS n FROM administrative_agenda WHERE statut = 'planifie' AND date_debut >= now()"),
      query("SELECT count(*)::int AS n FROM administrative_archives WHERE statut = 'ouvert'"),
      query("SELECT count(*)::int AS n FROM administrative_documents WHERE statut = 'actif'"),
    ]);
    res.json({
      courriers_a_traiter: courriers[0].n,
      rendez_vous_a_venir: rdv[0].n,
      dossiers_ouverts: dossiers[0].n,
      documents_actifs: documents[0].n,
    });
  })
);

export default router;

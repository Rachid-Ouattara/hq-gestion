import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();

router.get(
  '/',
  requirePermission('stocks', 'read'),
  asyncHandler(async (_req, res) => {
    const [{ rows: sousSeuil }, { rows: mouvements }, { rows: inventaires }, { rows: articles }] = await Promise.all([
      query(
        `SELECT count(*)::int AS n FROM stocks_articles
          WHERE is_active = true AND seuil_alerte > 0 AND quantite_stock <= seuil_alerte`
      ),
      query("SELECT count(*)::int AS n FROM stocks_mouvements WHERE created_at >= now() - interval '30 days'"),
      query("SELECT count(*)::int AS n FROM stocks_inventaires WHERE statut = 'en_cours'"),
      query('SELECT count(*)::int AS n FROM stocks_articles WHERE is_active = true'),
    ]);
    res.json({
      articles_sous_seuil: sousSeuil[0].n,
      mouvements_30j: mouvements[0].n,
      inventaires_en_cours: inventaires[0].n,
      articles_actifs: articles[0].n,
    });
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { registerMovement } from './stocks.service.js';
import { inventaireSchema, inventaireLignesSchema } from './stocks.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('stocks', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`i.statut = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT i.*, COUNT(l.id) AS nb_lignes
         FROM stocks_inventaires i
         LEFT JOIN stocks_inventaires_lignes l ON l.inventaire_id = i.id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        GROUP BY i.id
        ORDER BY i.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('stocks', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM stocks_inventaires WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Inventaire introuvable');
    const { rows: lignes } = await query(
      `SELECT l.*, a.designation AS article_designation, a.reference AS article_reference, a.unite AS article_unite
         FROM stocks_inventaires_lignes l
         JOIN stocks_articles a ON a.id = l.article_id
        WHERE l.inventaire_id = $1
        ORDER BY a.designation ASC`,
      [req.params.id]
    );
    res.json({ ...rows[0], lignes });
  })
);

router.post(
  '/',
  requirePermission('stocks', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = inventaireSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const i = parsed.data;

    const inventaire = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO stocks_inventaires (date_inventaire, observations, created_by)
         VALUES (COALESCE($1, CURRENT_DATE), $2, $3)
         RETURNING *`,
        [i.date_inventaire || null, i.observations || null, req.user.id]
      );
      const inventaireId = rows[0].id;
      await client.query(
        `INSERT INTO stocks_inventaires_lignes (inventaire_id, article_id, quantite_theorique)
         SELECT $1, id, quantite_stock FROM stocks_articles
          WHERE is_active AND ($2::uuid IS NULL OR categorie_id = $2)`,
        [inventaireId, i.categorie_id || null]
      );
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'stocks', entityType: 'inventaire', entityId: inventaire.id, ip: req.ip });
    res.status(201).json(inventaire);
  })
);

router.patch(
  '/:id/lignes',
  requirePermission('stocks', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = inventaireLignesSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (lignes requises)');
    const { lignes } = parsed.data;

    await withTransaction(async (client) => {
      const { rows: header } = await client.query('SELECT * FROM stocks_inventaires WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!header[0]) throw notFound('Inventaire introuvable');
      if (header[0].statut !== 'en_cours') throw badRequest('Seul un inventaire en cours peut être modifié');

      for (const l of lignes) {
        const { rowCount } = await client.query(
          `UPDATE stocks_inventaires_lignes SET quantite_comptee = $3
             WHERE id = $1 AND inventaire_id = $2`,
          [l.id, req.params.id, l.quantite_comptee]
        );
        if (rowCount === 0) throw badRequest("Une ligne n'appartient pas à cet inventaire");
      }
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'stocks', entityType: 'inventaire', entityId: req.params.id, details: { lignes: lignes.length }, ip: req.ip });

    const { rows: lignesUpdated } = await query(
      `SELECT l.*, a.designation AS article_designation
         FROM stocks_inventaires_lignes l JOIN stocks_articles a ON a.id = l.article_id
        WHERE l.inventaire_id = $1 ORDER BY a.designation ASC`,
      [req.params.id]
    );
    res.json({ lignes: lignesUpdated });
  })
);

router.post(
  '/:id/cloturer',
  requirePermission('stocks', 'update'),
  asyncHandler(async (req, res) => {
    const inventaire = await withTransaction(async (client) => {
      const { rows: header } = await client.query('SELECT * FROM stocks_inventaires WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!header[0]) throw notFound('Inventaire introuvable');
      if (header[0].statut !== 'en_cours') throw badRequest('Cet inventaire est déjà clôturé');

      const { rows: lignes } = await client.query('SELECT * FROM stocks_inventaires_lignes WHERE inventaire_id = $1', [req.params.id]);
      if (lignes.some((l) => l.quantite_comptee === null)) {
        throw badRequest('Toutes les lignes doivent être comptées avant la clôture');
      }

      for (const l of lignes) {
        const ecart = Number(l.quantite_comptee) - Number(l.quantite_theorique);
        if (ecart === 0) continue;
        await registerMovement(client, {
          articleId: l.article_id,
          type: ecart > 0 ? 'entree' : 'sortie',
          quantite: Math.abs(ecart),
          motif: 'ajustement_inventaire',
          sourceType: 'stocks_inventaire',
          sourceId: req.params.id,
          userId: req.user.id,
          observations: `Écart inventaire ${header[0].numero}`,
        });
      }

      const { rows: updated } = await client.query(
        `UPDATE stocks_inventaires SET statut = 'cloture', cloture_par = $2, cloture_at = now(), updated_at = now()
         WHERE id = $1 RETURNING *`,
        [req.params.id, req.user.id]
      );
      return updated[0];
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'stocks', entityType: 'inventaire', entityId: inventaire.id, details: { statut: 'cloture' }, ip: req.ip });
    res.json(inventaire);
  })
);

export default router;

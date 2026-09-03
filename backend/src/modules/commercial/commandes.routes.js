import { Router } from 'express';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { commandeSchema } from './commercial.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('commercial', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`c.statut = $${params.length}`);
    }
    if (req.query.client_id) {
      params.push(req.query.client_id);
      where.push(`c.client_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT c.*, cl.nom AS client_nom
         FROM commercial_commandes c
         JOIN commercial_clients cl ON cl.id = c.client_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY c.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('commercial', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT c.*, cl.nom AS client_nom, d.numero AS devis_numero
         FROM commercial_commandes c
         JOIN commercial_clients cl ON cl.id = c.client_id
         LEFT JOIN commercial_devis d ON d.id = c.devis_id
        WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Commande introuvable');
    const { rows: lignes } = await query(
      'SELECT * FROM commercial_commandes_lignes WHERE commande_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    const { rows: factures } = await query(
      'SELECT id, numero, statut, montant_total FROM commercial_factures WHERE commande_id = $1',
      [req.params.id]
    );
    res.json({ ...rows[0], lignes, factures });
  })
);

router.post(
  '/',
  requirePermission('commercial', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = commandeSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (client et au moins une ligne requis)');
    const c = parsed.data;

    const commande = await withTransaction(async (client) => {
      if (c.devis_id) {
        const { rows: devisRows } = await client.query('SELECT statut FROM commercial_devis WHERE id = $1', [c.devis_id]);
        if (!devisRows[0]) throw badRequest('Devis introuvable');
        if (devisRows[0].statut !== 'accepte') throw badRequest('Le devis lié doit être accepté avant de créer une commande');
        const { rows: existing } = await client.query('SELECT id FROM commercial_commandes WHERE devis_id = $1', [c.devis_id]);
        if (existing[0]) throw conflict('Une commande existe déjà pour ce devis');
      }

      const { rows } = await client.query(
        `INSERT INTO commercial_commandes (devis_id, client_id, date_commande, devise, conditions_livraison, created_by)
         VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5,$6)
         RETURNING *`,
        [c.devis_id || null, c.client_id, c.date_commande || null, c.devise || 'XOF', c.conditions_livraison || null, req.user.id]
      );
      const commandeId = rows[0].id;
      for (const l of c.lignes) {
        await client.query(
          `INSERT INTO commercial_commandes_lignes (commande_id, designation, quantite, unite, prix_unitaire)
           VALUES ($1,$2,$3,$4,$5)`,
          [commandeId, l.designation, l.quantite, l.unite || null, l.prix_unitaire]
        );
      }
      const { rows: totalRows } = await client.query(
        `UPDATE commercial_commandes SET montant_total =
           (SELECT COALESCE(SUM(montant), 0) FROM commercial_commandes_lignes WHERE commande_id = $1)
         WHERE id = $1 RETURNING *`,
        [commandeId]
      );
      return totalRows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'commercial', entityType: 'commande', entityId: commande.id, ip: req.ip });
    res.status(201).json(commande);
  })
);

router.patch(
  '/:id',
  requirePermission('commercial', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = commandeSchema.partial({ devis_id: true, client_id: true, lignes: true }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;

    const commande = await withTransaction(async (client) => {
      const { rows: current } = await client.query('SELECT statut FROM commercial_commandes WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current[0]) throw notFound('Commande introuvable');
      if (current[0].statut !== 'brouillon') throw badRequest('Seule une commande en brouillon peut être modifiée');

      await client.query(
        `UPDATE commercial_commandes SET
           client_id = COALESCE($2, client_id),
           date_commande = COALESCE($3, date_commande),
           devise = COALESCE($4, devise),
           conditions_livraison = COALESCE($5, conditions_livraison),
           updated_at = now()
         WHERE id = $1`,
        [req.params.id, c.client_id, c.date_commande, c.devise, c.conditions_livraison]
      );

      if (c.lignes) {
        await client.query('DELETE FROM commercial_commandes_lignes WHERE commande_id = $1', [req.params.id]);
        for (const l of c.lignes) {
          await client.query(
            `INSERT INTO commercial_commandes_lignes (commande_id, designation, quantite, unite, prix_unitaire)
             VALUES ($1,$2,$3,$4,$5)`,
            [req.params.id, l.designation, l.quantite, l.unite || null, l.prix_unitaire]
          );
        }
      }
      const { rows } = await client.query(
        `UPDATE commercial_commandes SET montant_total =
           (SELECT COALESCE(SUM(montant), 0) FROM commercial_commandes_lignes WHERE commande_id = $1)
         WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'commercial', entityType: 'commande', entityId: commande.id, ip: req.ip });
    res.json(commande);
  })
);

router.post(
  '/:id/confirmer',
  requirePermission('commercial', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE commercial_commandes SET statut = 'confirmee', updated_at = now()
       WHERE id = $1 AND statut = 'brouillon' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seule une commande en brouillon peut être confirmée');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'commercial', entityType: 'commande', entityId: rows[0].id, details: { statut: 'confirmee' }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/livrer',
  requirePermission('commercial', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE commercial_commandes SET statut = 'livree', updated_at = now()
       WHERE id = $1 AND statut = 'confirmee' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seule une commande confirmée peut être livrée');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'commercial', entityType: 'commande', entityId: rows[0].id, details: { statut: 'livree' }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/annuler',
  requirePermission('commercial', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows: commandeRows } = await query('SELECT * FROM commercial_commandes WHERE id = $1', [req.params.id]);
    if (!commandeRows[0]) throw notFound('Commande introuvable');
    if (commandeRows[0].statut === 'annulee') throw badRequest('Cette commande est déjà annulée');

    const { rows: factureRows } = await query('SELECT 1 FROM commercial_factures WHERE commande_id = $1 LIMIT 1', [req.params.id]);
    if (factureRows[0]) throw conflict('Impossible d’annuler : une facture existe déjà pour cette commande');

    const { rows } = await query(
      `UPDATE commercial_commandes SET statut = 'annulee', updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'commercial', entityType: 'commande', entityId: rows[0].id, details: { statut: 'annulee' }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requirePermission('commercial', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `DELETE FROM commercial_commandes WHERE id = $1 AND statut = 'brouillon' RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seule une commande en brouillon peut être supprimée');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'commercial', entityType: 'commande', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { bonSchema } from './achats.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('achats', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`b.statut = $${params.length}`);
    }
    if (req.query.fournisseur_id) {
      params.push(req.query.fournisseur_id);
      where.push(`b.fournisseur_id = $${params.length}`);
    }
    if (req.query.demande_id) {
      params.push(req.query.demande_id);
      where.push(`b.demande_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT b.*, f.nom AS fournisseur_nom
         FROM bons_de_commande b
         JOIN fournisseurs f ON f.id = b.fournisseur_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY b.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('achats', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT b.*, f.nom AS fournisseur_nom, f.telephone AS fournisseur_telephone,
              d.numero AS demande_numero, d.objet AS demande_objet
         FROM bons_de_commande b
         JOIN fournisseurs f ON f.id = b.fournisseur_id
         LEFT JOIN demandes_achat d ON d.id = b.demande_id
        WHERE b.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Bon de commande introuvable');

    const { rows: lignes } = await query(
      `SELECT l.*, COALESCE(r.recu, 0) AS quantite_recue
         FROM bons_de_commande_lignes l
         LEFT JOIN (
           SELECT bon_ligne_id, SUM(quantite_recue) AS recu
             FROM receptions_lignes GROUP BY bon_ligne_id
         ) r ON r.bon_ligne_id = l.id
        WHERE l.bon_id = $1
        ORDER BY l.created_at ASC`,
      [req.params.id]
    );
    const { rows: paiements } = await query(
      'SELECT * FROM paiements WHERE bon_id = $1 ORDER BY date_paiement DESC',
      [req.params.id]
    );
    const totalPaye = paiements.reduce((sum, p) => sum + Number(p.montant), 0);

    res.json({
      ...rows[0],
      lignes,
      paiements,
      total_paye: totalPaye,
      solde: Number(rows[0].montant_total) - totalPaye,
    });
  })
);

router.post(
  '/',
  requirePermission('achats', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = bonSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (fournisseur et au moins une ligne requis)');
    const b = parsed.data;

    const bon = await withTransaction(async (client) => {
      if (b.demande_id) {
        const { rows: demandeRows } = await client.query('SELECT statut FROM demandes_achat WHERE id = $1', [b.demande_id]);
        if (!demandeRows[0]) throw badRequest('Demande introuvable');
        if (demandeRows[0].statut !== 'validee') throw badRequest('La demande liée doit être validée avant de créer un bon de commande');
        const { rows: existing } = await client.query('SELECT id FROM bons_de_commande WHERE demande_id = $1', [b.demande_id]);
        if (existing[0]) throw conflict('Un bon de commande existe déjà pour cette demande');
      }

      const { rows } = await client.query(
        `INSERT INTO bons_de_commande (demande_id, fournisseur_id, date_commande, devise, conditions_livraison, created_by)
         VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5,$6)
         RETURNING *`,
        [b.demande_id || null, b.fournisseur_id, b.date_commande || null, b.devise || 'XOF', b.conditions_livraison || null, req.user.id]
      );
      const bonId = rows[0].id;
      for (const l of b.lignes) {
        await client.query(
          `INSERT INTO bons_de_commande_lignes (bon_id, designation, quantite, unite, prix_unitaire)
           VALUES ($1,$2,$3,$4,$5)`,
          [bonId, l.designation, l.quantite, l.unite || null, l.prix_unitaire]
        );
      }
      const { rows: totalRows } = await client.query(
        `UPDATE bons_de_commande SET montant_total =
           (SELECT COALESCE(SUM(montant), 0) FROM bons_de_commande_lignes WHERE bon_id = $1)
         WHERE id = $1 RETURNING *`,
        [bonId]
      );
      return totalRows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'achats', entityType: 'bon_de_commande', entityId: bon.id, ip: req.ip });
    res.status(201).json(bon);
  })
);

router.patch(
  '/:id',
  requirePermission('achats', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = bonSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const b = parsed.data;

    const bon = await withTransaction(async (client) => {
      const { rows: current } = await client.query('SELECT statut FROM bons_de_commande WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current[0]) throw notFound('Bon de commande introuvable');
      if (current[0].statut !== 'brouillon') throw badRequest('Seul un bon en brouillon peut être modifié');

      await client.query(
        `UPDATE bons_de_commande SET
           fournisseur_id = COALESCE($2, fournisseur_id),
           date_commande = COALESCE($3, date_commande),
           devise = COALESCE($4, devise),
           conditions_livraison = COALESCE($5, conditions_livraison),
           updated_at = now()
         WHERE id = $1`,
        [req.params.id, b.fournisseur_id, b.date_commande, b.devise, b.conditions_livraison]
      );

      if (b.lignes) {
        await client.query('DELETE FROM bons_de_commande_lignes WHERE bon_id = $1', [req.params.id]);
        for (const l of b.lignes) {
          await client.query(
            `INSERT INTO bons_de_commande_lignes (bon_id, designation, quantite, unite, prix_unitaire)
             VALUES ($1,$2,$3,$4,$5)`,
            [req.params.id, l.designation, l.quantite, l.unite || null, l.prix_unitaire]
          );
        }
      }
      const { rows } = await client.query(
        `UPDATE bons_de_commande SET montant_total =
           (SELECT COALESCE(SUM(montant), 0) FROM bons_de_commande_lignes WHERE bon_id = $1)
         WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'achats', entityType: 'bon_de_commande', entityId: bon.id, ip: req.ip });
    res.json(bon);
  })
);

router.post(
  '/:id/envoyer',
  requirePermission('achats', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE bons_de_commande SET statut = 'envoyee', updated_at = now()
       WHERE id = $1 AND statut = 'brouillon' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un bon en brouillon peut être envoyé');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'achats', entityType: 'bon_de_commande', entityId: rows[0].id, details: { statut: 'envoyee' }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/annuler',
  requirePermission('achats', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows: bonRows } = await query('SELECT * FROM bons_de_commande WHERE id = $1', [req.params.id]);
    if (!bonRows[0]) throw notFound('Bon de commande introuvable');
    if (bonRows[0].statut === 'annule') throw badRequest('Ce bon est déjà annulé');

    const { rows: recRows } = await query('SELECT 1 FROM receptions WHERE bon_id = $1 LIMIT 1', [req.params.id]);
    const { rows: payRows } = await query('SELECT 1 FROM paiements WHERE bon_id = $1 LIMIT 1', [req.params.id]);
    if (recRows[0] || payRows[0]) throw conflict('Impossible d’annuler : des réceptions ou paiements existent déjà pour ce bon');

    const { rows } = await query(
      `UPDATE bons_de_commande SET statut = 'annule', updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'achats', entityType: 'bon_de_commande', entityId: rows[0].id, details: { statut: 'annule' }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requirePermission('achats', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `DELETE FROM bons_de_commande WHERE id = $1 AND statut = 'brouillon' RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un bon en brouillon peut être supprimé');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'achats', entityType: 'bon_de_commande', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

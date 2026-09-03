import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { receptionSchema } from './achats.schemas.js';
import { registerMovement } from '../stocks/stocks.service.js';

const router = Router();

router.get(
  '/',
  requirePermission('achats', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.bon_id) {
      params.push(req.query.bon_id);
      where.push(`r.bon_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT r.*, b.numero AS bon_numero, u.full_name AS receptionne_par_nom
         FROM receptions r
         JOIN bons_de_commande b ON b.id = r.bon_id
         LEFT JOIN users u ON u.id = r.receptionne_par
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY r.created_at DESC`,
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
      `SELECT r.*, b.numero AS bon_numero
         FROM receptions r JOIN bons_de_commande b ON b.id = r.bon_id
        WHERE r.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Réception introuvable');
    const { rows: lignes } = await query(
      `SELECT rl.*, bl.designation, bl.quantite AS quantite_commandee
         FROM receptions_lignes rl
         JOIN bons_de_commande_lignes bl ON bl.id = rl.bon_ligne_id
        WHERE rl.reception_id = $1`,
      [req.params.id]
    );
    res.json({ ...rows[0], lignes });
  })
);

router.post(
  '/',
  requirePermission('achats', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = receptionSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (bon et au moins une ligne requis)');
    const rBody = parsed.data;

    const reception = await withTransaction(async (client) => {
      const { rows: bonRows } = await client.query('SELECT * FROM bons_de_commande WHERE id = $1 FOR UPDATE', [rBody.bon_id]);
      if (!bonRows[0]) throw badRequest('Bon de commande introuvable');
      if (bonRows[0].statut === 'annule' || bonRows[0].statut === 'brouillon') {
        throw badRequest('Le bon doit être envoyé avant de pouvoir enregistrer une réception');
      }

      const { rows: bonLignes } = await client.query('SELECT id FROM bons_de_commande_lignes WHERE bon_id = $1', [rBody.bon_id]);
      const validIds = new Set(bonLignes.map((l) => l.id));
      for (const l of rBody.lignes) {
        if (!validIds.has(l.bon_ligne_id)) throw badRequest("Une ligne réceptionnée n'appartient pas à ce bon de commande");
      }

      const { rows: recRows } = await client.query(
        `INSERT INTO receptions (bon_id, date_reception, type, receptionne_par, observations)
         VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5)
         RETURNING *`,
        [rBody.bon_id, rBody.date_reception || null, rBody.type, req.user.id, rBody.observations || null]
      );
      const receptionId = recRows[0].id;
      for (const l of rBody.lignes) {
        await client.query(
          `INSERT INTO receptions_lignes (reception_id, bon_ligne_id, quantite_recue, etat)
           VALUES ($1,$2,$3,$4)`,
          [receptionId, l.bon_ligne_id, l.quantite_recue, l.etat]
        );
        if (l.article_id && l.etat === 'conforme') {
          await registerMovement(client, {
            articleId: l.article_id,
            type: 'entree',
            quantite: l.quantite_recue,
            motif: 'reception_achat',
            sourceType: 'achats_reception',
            sourceId: receptionId,
            userId: req.user.id,
            observations: `Réception ${rBody.type} — bon ${bonRows[0].numero}`,
          });
        }
      }

      const { rows: progress } = await client.query(
        `SELECT bl.id, bl.quantite, COALESCE(SUM(rl.quantite_recue), 0) AS recu
           FROM bons_de_commande_lignes bl
           LEFT JOIN receptions_lignes rl ON rl.bon_ligne_id = bl.id
          WHERE bl.bon_id = $1
          GROUP BY bl.id, bl.quantite`,
        [rBody.bon_id]
      );
      const complet = progress.every((l) => Number(l.recu) >= Number(l.quantite));
      const nouveauStatut = complet ? 'receptionnee_complete' : 'receptionnee_partielle';
      await client.query(
        `UPDATE bons_de_commande SET statut = $2, updated_at = now() WHERE id = $1`,
        [rBody.bon_id, nouveauStatut]
      );

      return recRows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'achats', entityType: 'reception', entityId: reception.id, ip: req.ip });
    res.status(201).json(reception);
  })
);

export default router;

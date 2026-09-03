import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { paiementSchema } from './achats.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('achats', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.bon_id) {
      params.push(req.query.bon_id);
      where.push(`p.bon_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT p.*, b.numero AS bon_numero, u.full_name AS enregistre_par_nom
         FROM paiements p
         JOIN bons_de_commande b ON b.id = p.bon_id
         LEFT JOIN users u ON u.id = p.enregistre_par
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY p.date_paiement DESC`,
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
      `SELECT p.*, b.numero AS bon_numero
         FROM paiements p JOIN bons_de_commande b ON b.id = p.bon_id
        WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Paiement introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('achats', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = paiementSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (bon, montant > 0 et mode requis)');
    const p = parsed.data;

    const paiement = await withTransaction(async (client) => {
      const { rows: bonRows } = await client.query('SELECT * FROM bons_de_commande WHERE id = $1 FOR UPDATE', [p.bon_id]);
      if (!bonRows[0]) throw badRequest('Bon de commande introuvable');
      if (bonRows[0].statut === 'annule') throw badRequest('Impossible de payer un bon annulé');

      const { rows: sumRows } = await client.query(
        'SELECT COALESCE(SUM(montant), 0) AS total FROM paiements WHERE bon_id = $1',
        [p.bon_id]
      );
      const solde = Number(bonRows[0].montant_total) - Number(sumRows[0].total);
      if (p.montant > solde) throw badRequest(`Le montant dépasse le solde restant dû (${solde.toFixed(2)})`);

      const { rows } = await client.query(
        `INSERT INTO paiements (bon_id, montant, date_paiement, mode, reference, enregistre_par)
         VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5,$6)
         RETURNING *`,
        [p.bon_id, p.montant, p.date_paiement || null, p.mode, p.reference || null, req.user.id]
      );
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'achats', entityType: 'paiement', entityId: paiement.id, ip: req.ip });
    res.status(201).json(paiement);
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { adjustCompteSolde } from '../finance/finance.service.js';
import { encaissementSchema } from './commercial.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('commercial', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.facture_id) {
      params.push(req.query.facture_id);
      where.push(`e.facture_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT e.*, f.numero AS facture_numero, u.full_name AS enregistre_par_nom
         FROM commercial_encaissements e
         JOIN commercial_factures f ON f.id = e.facture_id
         LEFT JOIN users u ON u.id = e.enregistre_par
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY e.date_encaissement DESC`,
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
      `SELECT e.*, f.numero AS facture_numero
         FROM commercial_encaissements e JOIN commercial_factures f ON f.id = e.facture_id
        WHERE e.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Encaissement introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('commercial', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = encaissementSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (facture, montant > 0 et mode requis)');
    const e = parsed.data;

    const encaissement = await withTransaction(async (client) => {
      const { rows: factureRows } = await client.query('SELECT * FROM commercial_factures WHERE id = $1 FOR UPDATE', [e.facture_id]);
      if (!factureRows[0]) throw badRequest('Facture introuvable');
      if (factureRows[0].statut === 'annulee') throw badRequest('Impossible d’encaisser une facture annulée');

      const { rows: sumRows } = await client.query(
        'SELECT COALESCE(SUM(montant), 0) AS total FROM commercial_encaissements WHERE facture_id = $1',
        [e.facture_id]
      );
      const dejaEncaisse = Number(sumRows[0].total);
      const solde = Number(factureRows[0].montant_total) - dejaEncaisse;
      if (e.montant > solde) throw badRequest(`Le montant dépasse le solde restant dû (${solde.toFixed(2)})`);

      const { rows } = await client.query(
        `INSERT INTO commercial_encaissements (facture_id, compte_id, montant, date_encaissement, mode, reference, enregistre_par)
         VALUES ($1,$2,$3,COALESCE($4, CURRENT_DATE),$5,$6,$7)
         RETURNING *`,
        [e.facture_id, e.compte_id || null, e.montant, e.date_encaissement || null, e.mode, e.reference || null, req.user.id]
      );

      const totalEncaisse = dejaEncaisse + e.montant;
      const nouveauStatut = totalEncaisse >= Number(factureRows[0].montant_total) ? 'payee' : 'partiellement_payee';
      await client.query(
        `UPDATE commercial_factures SET statut = $2, updated_at = now() WHERE id = $1`,
        [e.facture_id, nouveauStatut]
      );

      if (e.compte_id) {
        await adjustCompteSolde(client, { compteId: e.compte_id, delta: e.montant });
      }

      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'commercial', entityType: 'encaissement', entityId: encaissement.id, ip: req.ip });
    res.status(201).json(encaissement);
  })
);

export default router;

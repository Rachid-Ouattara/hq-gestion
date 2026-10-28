import { Router } from 'express';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { factureSchema } from './commercial.schemas.js';
import { newDocument, drawLetterhead, drawDestinataire, drawLignesTable, drawTotal } from '../../lib/pdf/documentPdf.js';

const router = Router();

router.get(
  '/',
  requirePermission('commercial', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`f.statut = $${params.length}`);
    }
    if (req.query.client_id) {
      params.push(req.query.client_id);
      where.push(`f.client_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT f.*, c.nom AS client_nom
         FROM commercial_factures f
         JOIN commercial_clients c ON c.id = f.client_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY f.created_at DESC`,
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
      `SELECT f.*, c.nom AS client_nom, c.telephone AS client_telephone,
              cmd.numero AS commande_numero
         FROM commercial_factures f
         JOIN commercial_clients c ON c.id = f.client_id
         LEFT JOIN commercial_commandes cmd ON cmd.id = f.commande_id
        WHERE f.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Facture introuvable');

    const { rows: lignes } = await query(
      'SELECT * FROM commercial_factures_lignes WHERE facture_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    const { rows: encaissements } = await query(
      'SELECT * FROM commercial_encaissements WHERE facture_id = $1 ORDER BY date_encaissement DESC',
      [req.params.id]
    );
    const totalEncaisse = encaissements.reduce((sum, e) => sum + Number(e.montant), 0);

    res.json({
      ...rows[0],
      lignes,
      encaissements,
      total_encaisse: totalEncaisse,
      solde: Number(rows[0].montant_total) - totalEncaisse,
    });
  })
);

router.get(
  '/:id/pdf',
  requirePermission('commercial', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT f.*, c.nom, c.contact_nom, c.adresse, c.telephone, c.email, c.numero_fiscal
         FROM commercial_factures f
         JOIN commercial_clients c ON c.id = f.client_id
        WHERE f.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Facture introuvable');
    const facture = rows[0];
    const { rows: lignes } = await query(
      'SELECT * FROM commercial_factures_lignes WHERE facture_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    const { rows: entrepriseRows } = await query('SELECT * FROM parametres_entreprise WHERE id = 1');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${facture.numero}.pdf"`);
    const doc = newDocument();
    doc.pipe(res);
    drawLetterhead(doc, entrepriseRows[0], {
      titre: 'FACTURE',
      numero: facture.numero,
      date: new Date(facture.date_facture).toLocaleDateString('fr-FR'),
    });
    drawDestinataire(doc, { label: 'Facturé à', tiers: facture });
    drawLignesTable(doc, lignes);
    drawTotal(doc, 'Total', facture.montant_total);
    doc.end();
  })
);

router.post(
  '/',
  requirePermission('commercial', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = factureSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (client et au moins une ligne requis)');
    const f = parsed.data;

    const facture = await withTransaction(async (client) => {
      if (f.commande_id) {
        const { rows: commandeRows } = await client.query('SELECT statut FROM commercial_commandes WHERE id = $1', [f.commande_id]);
        if (!commandeRows[0]) throw badRequest('Commande introuvable');
        if (!['confirmee', 'livree'].includes(commandeRows[0].statut)) {
          throw badRequest('La commande liée doit être confirmée ou livrée avant de créer une facture');
        }
        const { rows: existing } = await client.query('SELECT id FROM commercial_factures WHERE commande_id = $1', [f.commande_id]);
        if (existing[0]) throw conflict('Une facture existe déjà pour cette commande');
      }

      const { rows } = await client.query(
        `INSERT INTO commercial_factures (commande_id, client_id, date_facture, echeance, created_by)
         VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5)
         RETURNING *`,
        [f.commande_id || null, f.client_id, f.date_facture || null, f.echeance || null, req.user.id]
      );
      const factureId = rows[0].id;
      for (const l of f.lignes) {
        await client.query(
          `INSERT INTO commercial_factures_lignes (facture_id, designation, quantite, unite, prix_unitaire)
           VALUES ($1,$2,$3,$4,$5)`,
          [factureId, l.designation, l.quantite, l.unite || null, l.prix_unitaire]
        );
      }
      const { rows: totalRows } = await client.query(
        `UPDATE commercial_factures SET montant_total =
           (SELECT COALESCE(SUM(montant), 0) FROM commercial_factures_lignes WHERE facture_id = $1)
         WHERE id = $1 RETURNING *`,
        [factureId]
      );

      if (f.commande_id) {
        await client.query(`UPDATE commercial_commandes SET statut = 'facturee', updated_at = now() WHERE id = $1`, [f.commande_id]);
      }

      return totalRows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'commercial', entityType: 'facture', entityId: facture.id, ip: req.ip });
    res.status(201).json(facture);
  })
);

router.patch(
  '/:id',
  requirePermission('commercial', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = factureSchema.partial({ commande_id: true, client_id: true, lignes: true }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const f = parsed.data;

    const facture = await withTransaction(async (client) => {
      const { rows: current } = await client.query('SELECT statut FROM commercial_factures WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current[0]) throw notFound('Facture introuvable');
      if (current[0].statut !== 'emise') throw badRequest('Seule une facture émise (sans encaissement) peut être modifiée');

      await client.query(
        `UPDATE commercial_factures SET
           client_id = COALESCE($2, client_id), date_facture = COALESCE($3, date_facture),
           echeance = COALESCE($4, echeance), updated_at = now()
         WHERE id = $1`,
        [req.params.id, f.client_id, f.date_facture, f.echeance]
      );

      if (f.lignes) {
        await client.query('DELETE FROM commercial_factures_lignes WHERE facture_id = $1', [req.params.id]);
        for (const l of f.lignes) {
          await client.query(
            `INSERT INTO commercial_factures_lignes (facture_id, designation, quantite, unite, prix_unitaire)
             VALUES ($1,$2,$3,$4,$5)`,
            [req.params.id, l.designation, l.quantite, l.unite || null, l.prix_unitaire]
          );
        }
      }
      const { rows } = await client.query(
        `UPDATE commercial_factures SET montant_total =
           (SELECT COALESCE(SUM(montant), 0) FROM commercial_factures_lignes WHERE facture_id = $1)
         WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'commercial', entityType: 'facture', entityId: facture.id, ip: req.ip });
    res.json(facture);
  })
);

router.post(
  '/:id/annuler',
  requirePermission('commercial', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows: factureRows } = await query('SELECT * FROM commercial_factures WHERE id = $1', [req.params.id]);
    if (!factureRows[0]) throw notFound('Facture introuvable');
    if (factureRows[0].statut === 'annulee') throw badRequest('Cette facture est déjà annulée');

    const { rows: encRows } = await query('SELECT 1 FROM commercial_encaissements WHERE facture_id = $1 LIMIT 1', [req.params.id]);
    if (encRows[0]) throw conflict('Impossible d’annuler : des encaissements existent déjà pour cette facture');

    const { rows } = await query(
      `UPDATE commercial_factures SET statut = 'annulee', updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'commercial', entityType: 'facture', entityId: rows[0].id, details: { statut: 'annulee' }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requirePermission('commercial', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `DELETE FROM commercial_factures WHERE id = $1 AND statut = 'emise' RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seule une facture émise sans encaissement peut être supprimée');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'commercial', entityType: 'facture', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

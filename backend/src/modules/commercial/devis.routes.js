import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { devisSchema } from './commercial.schemas.js';
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
      where.push(`d.statut = $${params.length}`);
    }
    if (req.query.client_id) {
      params.push(req.query.client_id);
      where.push(`d.client_id = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`d.objet ILIKE $${params.length}`);
    }
    const { rows } = await query(
      `SELECT d.*, c.nom AS client_nom
         FROM commercial_devis d
         JOIN commercial_clients c ON c.id = d.client_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY d.created_at DESC`,
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
      `SELECT d.*, c.nom AS client_nom
         FROM commercial_devis d JOIN commercial_clients c ON c.id = d.client_id
        WHERE d.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Devis introuvable');
    const { rows: lignes } = await query(
      'SELECT * FROM commercial_devis_lignes WHERE devis_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ ...rows[0], lignes });
  })
);

router.get(
  '/:id/pdf',
  requirePermission('commercial', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT d.*, c.nom, c.contact_nom, c.adresse, c.telephone, c.email, c.numero_fiscal
         FROM commercial_devis d JOIN commercial_clients c ON c.id = d.client_id
        WHERE d.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Devis introuvable');
    const devis = rows[0];
    const { rows: lignes } = await query(
      'SELECT * FROM commercial_devis_lignes WHERE devis_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    const { rows: entrepriseRows } = await query('SELECT * FROM parametres_entreprise WHERE id = 1');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${devis.numero}.pdf"`);
    const doc = newDocument();
    doc.pipe(res);
    drawLetterhead(doc, entrepriseRows[0], {
      titre: 'DEVIS',
      numero: devis.numero,
      date: new Date(devis.date_devis).toLocaleDateString('fr-FR'),
    });
    drawDestinataire(doc, { label: 'Devis pour', tiers: devis });
    doc.font('Helvetica').fontSize(10).fillColor('#555').text(`Objet : ${devis.objet}`, 50, doc.y);
    doc.fillColor('#000').moveDown(1);
    drawLignesTable(doc, lignes);
    drawTotal(doc, 'Total', devis.montant_total);
    doc.font('Helvetica').fontSize(9).fillColor('#888').text(`Validité : ${devis.validite_jours} jours`, 50, doc.y);
    doc.end();
  })
);

router.post(
  '/',
  requirePermission('commercial', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = devisSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (objet, client et au moins une ligne requis)');
    const d = parsed.data;

    const devis = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO commercial_devis (objet, client_id, date_devis, validite_jours, created_by)
         VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5)
         RETURNING *`,
        [d.objet, d.client_id, d.date_devis || null, d.validite_jours, req.user.id]
      );
      const devisId = rows[0].id;
      for (const l of d.lignes) {
        await client.query(
          `INSERT INTO commercial_devis_lignes (devis_id, designation, quantite, unite, prix_unitaire)
           VALUES ($1,$2,$3,$4,$5)`,
          [devisId, l.designation, l.quantite, l.unite || null, l.prix_unitaire]
        );
      }
      const { rows: totalRows } = await client.query(
        `UPDATE commercial_devis SET montant_total =
           (SELECT COALESCE(SUM(montant), 0) FROM commercial_devis_lignes WHERE devis_id = $1)
         WHERE id = $1 RETURNING *`,
        [devisId]
      );
      return totalRows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'commercial', entityType: 'devis', entityId: devis.id, ip: req.ip });
    res.status(201).json(devis);
  })
);

router.patch(
  '/:id',
  requirePermission('commercial', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = devisSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (objet, client et au moins une ligne requis)');
    const d = parsed.data;

    const devis = await withTransaction(async (client) => {
      const { rows: current } = await client.query('SELECT statut FROM commercial_devis WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current[0]) throw notFound('Devis introuvable');
      if (current[0].statut !== 'brouillon') throw badRequest('Seul un devis en brouillon peut être modifié');

      await client.query(
        `UPDATE commercial_devis SET objet=$2, client_id=$3, date_devis=COALESCE($4, date_devis), validite_jours=$5, updated_at=now()
         WHERE id = $1`,
        [req.params.id, d.objet, d.client_id, d.date_devis || null, d.validite_jours]
      );
      await client.query('DELETE FROM commercial_devis_lignes WHERE devis_id = $1', [req.params.id]);
      for (const l of d.lignes) {
        await client.query(
          `INSERT INTO commercial_devis_lignes (devis_id, designation, quantite, unite, prix_unitaire)
           VALUES ($1,$2,$3,$4,$5)`,
          [req.params.id, l.designation, l.quantite, l.unite || null, l.prix_unitaire]
        );
      }
      const { rows } = await client.query(
        `UPDATE commercial_devis SET montant_total =
           (SELECT COALESCE(SUM(montant), 0) FROM commercial_devis_lignes WHERE devis_id = $1)
         WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'commercial', entityType: 'devis', entityId: devis.id, ip: req.ip });
    res.json(devis);
  })
);

router.delete(
  '/:id',
  requirePermission('commercial', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `DELETE FROM commercial_devis WHERE id = $1 AND statut = 'brouillon' RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un devis en brouillon peut être supprimé');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'commercial', entityType: 'devis', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

router.post(
  '/:id/envoyer',
  requirePermission('commercial', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE commercial_devis SET statut = 'envoye', updated_at = now()
       WHERE id = $1 AND statut = 'brouillon' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un devis en brouillon peut être envoyé');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'commercial', entityType: 'devis', entityId: rows[0].id, details: { statut: 'envoye' }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/accepter',
  requirePermission('commercial', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE commercial_devis SET statut = 'accepte', updated_at = now()
       WHERE id = $1 AND statut = 'envoye' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un devis envoyé peut être accepté');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'commercial', entityType: 'devis', entityId: rows[0].id, details: { statut: 'accepte' }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/refuser',
  requirePermission('commercial', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE commercial_devis SET statut = 'refuse', updated_at = now()
       WHERE id = $1 AND statut = 'envoye' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un devis envoyé peut être refusé');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'commercial', entityType: 'devis', entityId: rows[0].id, details: { statut: 'refuse' }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/expirer',
  requirePermission('commercial', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE commercial_devis SET statut = 'expire', updated_at = now()
       WHERE id = $1 AND statut = 'envoye' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un devis envoyé peut être marqué expiré');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'commercial', entityType: 'devis', entityId: rows[0].id, details: { statut: 'expire' }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { paieSchema } from './rh.schemas.js';
import { newDocument, drawLetterhead, drawTotal } from '../../lib/pdf/documentPdf.js';

const router = Router();

router.get(
  '/',
  requirePermission('rh_paie', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.periode) {
      params.push(req.query.periode);
      where.push(`p.periode = $${params.length}`);
    }
    if (req.query.employe_id) {
      params.push(req.query.employe_id);
      where.push(`p.employe_id = $${params.length}`);
    }
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`p.statut = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT p.*, e.nom AS employe_nom, e.prenom AS employe_prenom
         FROM rh_paies p JOIN rh_employes e ON e.id = p.employe_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY p.periode DESC, e.nom ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('rh_paie', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT p.*, e.nom AS employe_nom, e.prenom AS employe_prenom
         FROM rh_paies p JOIN rh_employes e ON e.id = p.employe_id
        WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Paie introuvable');
    res.json(rows[0]);
  })
);

router.get(
  '/:id/pdf',
  requirePermission('rh_paie', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT p.*, e.nom, e.prenom, e.matricule, e.poste, e.departement
         FROM rh_paies p JOIN rh_employes e ON e.id = p.employe_id
        WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Paie introuvable');
    const paie = rows[0];
    const { rows: entrepriseRows } = await query('SELECT * FROM parametres_entreprise WHERE id = 1');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${paie.numero}.pdf"`);
    const doc = newDocument();
    doc.pipe(res);
    drawLetterhead(doc, entrepriseRows[0], {
      titre: 'BULLETIN DE PAIE',
      numero: paie.numero,
      date: `Période : ${paie.periode}`,
    });

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#888').text('EMPLOYÉ', 50, doc.y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(`${paie.nom} ${paie.prenom}`, 50, doc.y + 3);
    doc.font('Helvetica').fontSize(9).fillColor('#555');
    const lignesEmploye = [`Matricule : ${paie.matricule}`, paie.poste, paie.departement].filter(Boolean);
    doc.text(lignesEmploye.join('\n'), 50, doc.y + 2, { width: 300 });
    doc.fillColor('#000').moveDown(2);

    drawTotal(doc, 'Salaire de base', paie.salaire_base, { bold: false });
    drawTotal(doc, 'Primes', paie.primes, { bold: false });
    drawTotal(doc, 'Déductions', -paie.deductions, { bold: false });
    doc.moveTo(350, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(0.5);
    drawTotal(doc, 'Salaire net', paie.salaire_net);
    doc.end();
  })
);

router.post(
  '/',
  requirePermission('rh_paie', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = paieSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (employé et période AAAA-MM requis)');
    const p = parsed.data;
    try {
      const { rows } = await query(
        `INSERT INTO rh_paies (employe_id, periode, salaire_base, primes, deductions, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [p.employe_id, p.periode, p.salaire_base ?? 0, p.primes ?? 0, p.deductions ?? 0, req.user.id]
      );
      await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'paie', entityId: rows[0].id, ip: req.ip });
      res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === '23505') throw conflict('Une paie existe déjà pour cet employé sur cette période');
      throw err;
    }
  })
);

router.patch(
  '/:id',
  requirePermission('rh_paie', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = paieSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const p = parsed.data;
    const { rows } = await query(
      `UPDATE rh_paies SET
         periode = COALESCE($2, periode), salaire_base = COALESCE($3, salaire_base),
         primes = COALESCE($4, primes), deductions = COALESCE($5, deductions), updated_at = now()
       WHERE id = $1 AND statut = 'brouillon' RETURNING *`,
      [req.params.id, p.periode, p.salaire_base, p.primes, p.deductions]
    );
    if (!rows[0]) throw badRequest('Seule une paie en brouillon peut être modifiée');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'paie', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/payer',
  requirePermission('rh_paie', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE rh_paies SET statut = 'payee', date_paiement = CURRENT_DATE, updated_at = now()
       WHERE id = $1 AND statut = 'brouillon' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seule une paie en brouillon peut être marquée payée');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'paie', entityId: rows[0].id, details: { statut: 'payee' }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

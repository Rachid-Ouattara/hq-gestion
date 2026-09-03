import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { ecoleCibleSchema } from './prospection.schemas.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get(
  '/',
  requirePermission('prospection', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.campagne_id) {
      params.push(req.query.campagne_id);
      where.push(`e.campagne_id = $${params.length}`);
    }
    if (req.query.groupe_id) {
      params.push(req.query.groupe_id);
      where.push(`e.groupe_id = $${params.length}`);
    }
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`e.statut = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`(e.nom ILIKE $${params.length} OR e.ville ILIKE $${params.length})`);
    }
    const { rows } = await query(
      `SELECT e.*, c.nom AS campagne_nom, g.nom AS groupe_nom
         FROM prospection_ecoles_cibles e
         JOIN prospection_campagnes c ON c.id = e.campagne_id
         LEFT JOIN prospection_groupes g ON g.id = e.groupe_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY e.nom ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('prospection', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT e.*, c.nom AS campagne_nom, g.nom AS groupe_nom
         FROM prospection_ecoles_cibles e
         JOIN prospection_campagnes c ON c.id = e.campagne_id
         LEFT JOIN prospection_groupes g ON g.id = e.groupe_id
        WHERE e.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('École cible introuvable');
    const { rows: rapports } = await query(
      'SELECT * FROM prospection_rapports WHERE ecole_cible_id = $1 ORDER BY date_contact DESC',
      [req.params.id]
    );
    res.json({ ...rows[0], rapports });
  })
);

router.post(
  '/',
  requirePermission('prospection', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = ecoleCibleSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (campagne et nom requis)');
    const e = parsed.data;
    const { rows } = await query(
      `INSERT INTO prospection_ecoles_cibles (campagne_id, groupe_id, nom, ville, contact_nom, contact_telephone, contact_email, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [e.campagne_id, e.groupe_id || null, e.nom, e.ville || null, e.contact_nom || null, e.contact_telephone || null, e.contact_email || null, e.notes || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'prospection', entityType: 'ecole_cible', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('prospection', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = ecoleCibleSchema.partial({ campagne_id: true, nom: true }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const e = parsed.data;
    const { rows } = await query(
      `UPDATE prospection_ecoles_cibles SET
         groupe_id = COALESCE($2, groupe_id), nom = COALESCE($3, nom), ville = COALESCE($4, ville),
         contact_nom = COALESCE($5, contact_nom), contact_telephone = COALESCE($6, contact_telephone),
         contact_email = COALESCE($7, contact_email), notes = COALESCE($8, notes), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, e.groupe_id, e.nom, e.ville, e.contact_nom, e.contact_telephone, e.contact_email, e.notes]
    );
    if (!rows[0]) throw notFound('École cible introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'prospection', entityType: 'ecole_cible', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('prospection', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut;
    const valides = ['a_contacter', 'contacte', 'interesse', 'en_negociation', 'partenaire', 'refuse', 'abandonne'];
    if (!valides.includes(statut)) throw badRequest('Statut invalide');
    const terminal = ['partenaire', 'refuse', 'abandonne'].includes(statut);
    const { rows } = await query(
      `UPDATE prospection_ecoles_cibles
          SET statut = $2, date_relance = CASE WHEN $3 THEN NULL ELSE date_relance END, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [req.params.id, statut, terminal]
    );
    if (!rows[0]) throw notFound('École cible introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'prospection', entityType: 'ecole_cible', entityId: rows[0].id, details: { statut }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requirePermission('prospection', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM prospection_ecoles_cibles WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw notFound('École cible introuvable');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'prospection', entityType: 'ecole_cible', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

// Colonnes attendues (dans l'ordre) : Nom | Ville | Contact | Téléphone | Email
// 1ère ligne = en-tête, ignorée.
router.post(
  '/import',
  requirePermission('prospection', 'create'),
  upload.single('fichier'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Fichier .xlsx requis');
    const campagneId = req.body?.campagne_id;
    const groupeId = req.body?.groupe_id || null;
    if (!campagneId) throw badRequest('Campagne requise');

    const { rows: campRows } = await query('SELECT id FROM prospection_campagnes WHERE id = $1', [campagneId]);
    if (!campRows[0]) throw badRequest('Campagne introuvable');
    if (groupeId) {
      const { rows: groupeRows } = await query(
        'SELECT id FROM prospection_groupes WHERE id = $1 AND campagne_id = $2',
        [groupeId, campagneId]
      );
      if (!groupeRows[0]) throw badRequest('Groupe introuvable pour cette campagne');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(req.file.buffer);
    } catch {
      throw badRequest('Fichier illisible : vérifiez le format .xlsx');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw badRequest('Le fichier ne contient aucune feuille');

    let imported = 0;
    let skipped = 0;

    await withTransaction(async (client) => {
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const cell = (i) => {
          const v = row.getCell(i).value;
          if (v == null) return null;
          const text = typeof v === 'object' && 'text' in v ? v.text : String(v);
          const trimmed = String(text).trim();
          return trimmed === '' ? null : trimmed;
        };
        const nom = cell(1);
        if (!nom) { skipped += 1; continue; }
        await client.query(
          `INSERT INTO prospection_ecoles_cibles (campagne_id, groupe_id, nom, ville, contact_nom, contact_telephone, contact_email, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [campagneId, groupeId, nom, cell(2), cell(3), cell(4), cell(5), req.user.id]
        );
        imported += 1;
      }
    });

    if (imported === 0 && skipped === 0) throw badRequest('Le fichier ne contient aucune ligne à importer');

    await logAudit({
      userId: req.user.id,
      action: 'create',
      moduleCode: 'prospection',
      entityType: 'import_ecoles_cibles',
      entityId: campagneId,
      details: { imported, skipped },
      ip: req.ip,
    });
    res.status(201).json({ imported, skipped });
  })
);

router.post(
  '/:id/convertir',
  requirePermission('prospection', 'update'),
  asyncHandler(async (req, res) => {
    const ecole = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM prospection_ecoles_cibles WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!rows[0]) throw notFound('École cible introuvable');
      const cible = rows[0];
      if (cible.statut !== 'partenaire') throw badRequest('L\'école doit être au statut "partenaire" avant conversion');
      if (cible.ecole_partenaire_id) throw conflict('Cette école cible a déjà été convertie');
      if (!cible.ville) throw badRequest('Renseignez la ville avant de convertir cette école');

      const { rows: fe } = await client.query(
        `INSERT INTO formation_ecoles (nom, ville, contact_nom, contact_telephone, contact_email, statut_partenariat, date_debut_partenariat, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,'actif',CURRENT_DATE,$6,$7)
         RETURNING *`,
        [cible.nom, cible.ville, cible.contact_nom, cible.contact_telephone, cible.contact_email, cible.notes, req.user.id]
      );
      await client.query(
        'UPDATE prospection_ecoles_cibles SET ecole_partenaire_id = $2, updated_at = now() WHERE id = $1',
        [cible.id, fe[0].id]
      );
      return fe[0];
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'prospection', entityType: 'conversion', entityId: req.params.id, details: { ecole_partenaire_id: ecole.id }, ip: req.ip });
    res.status(201).json(ecole);
  })
);

export default router;

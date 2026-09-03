import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { contratSchema } from './rh.schemas.js';

const router = Router();
router.use(requireStaff);

const SELECT_BASE = `
  SELECT c.*, e.nom AS employe_nom, e.prenom AS employe_prenom,
         (c.date_fin IS NOT NULL AND c.statut = 'actif' AND c.date_fin <= CURRENT_DATE + INTERVAL '30 days') AS echeance_proche
    FROM rh_contrats c
    JOIN rh_employes e ON e.id = c.employe_id
`;

router.get(
  '/',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.employe_id) {
      params.push(req.query.employe_id);
      where.push(`c.employe_id = $${params.length}`);
    }
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`c.statut = $${params.length}`);
    }
    const { rows } = await query(
      `${SELECT_BASE} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY c.date_debut DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT_BASE} WHERE c.id = $1`, [req.params.id]);
    if (!rows[0]) throw notFound('Contrat introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const bodySchema = contratSchema.safeParse(req.body);
    if (!bodySchema.success) throw badRequest('Champs invalides (type de contrat et date de début requis)');
    const employeId = req.body?.employe_id;
    if (!employeId) throw badRequest('employe_id requis');
    const { rows: empRows } = await query('SELECT id FROM rh_employes WHERE id = $1', [employeId]);
    if (!empRows[0]) throw badRequest('Employé introuvable');
    const c = bodySchema.data;
    const { rows } = await query(
      `INSERT INTO rh_contrats (employe_id, type_contrat, poste, date_debut, date_fin, salaire_base, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [employeId, c.type_contrat, c.poste || null, c.date_debut, c.date_fin || null, c.salaire_base ?? 0, c.notes || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'contrat', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = contratSchema.partial({ type_contrat: true, date_debut: true }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;
    const { rows } = await query(
      `UPDATE rh_contrats SET
         type_contrat = COALESCE($2, type_contrat), poste = COALESCE($3, poste),
         date_debut = COALESCE($4, date_debut), date_fin = COALESCE($5, date_fin),
         salaire_base = COALESCE($6, salaire_base), notes = COALESCE($7, notes), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, c.type_contrat, c.poste, c.date_debut, c.date_fin, c.salaire_base, c.notes]
    );
    if (!rows[0]) throw notFound('Contrat introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'contrat', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut;
    if (!['actif', 'expire', 'resilie', 'renouvele'].includes(statut)) throw badRequest('Statut invalide');
    const { rows } = await query(
      `UPDATE rh_contrats SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, statut]
    );
    if (!rows[0]) throw notFound('Contrat introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'contrat', entityId: rows[0].id, details: { statut }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/renouveler',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = contratSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (type de contrat et date de début requis)');
    const c = parsed.data;

    const nouveau = await withTransaction(async (client) => {
      const { rows: ancienRows } = await client.query('SELECT * FROM rh_contrats WHERE id = $1 FOR UPDATE', [req.params.id]);
      const ancien = ancienRows[0];
      if (!ancien) throw notFound('Contrat introuvable');

      const { rows: nouveauRows } = await client.query(
        `INSERT INTO rh_contrats (employe_id, type_contrat, poste, date_debut, date_fin, salaire_base, notes, contrat_precedent_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [ancien.employe_id, c.type_contrat, c.poste || ancien.poste, c.date_debut, c.date_fin || null, c.salaire_base ?? ancien.salaire_base, c.notes || null, ancien.id, req.user.id]
      );

      await client.query(`UPDATE rh_contrats SET statut = 'renouvele', updated_at = now() WHERE id = $1`, [ancien.id]);
      await client.query(
        `UPDATE rh_employes SET type_contrat = $2, salaire_base = $3, updated_at = now() WHERE id = $1`,
        [ancien.employe_id, c.type_contrat, c.salaire_base ?? ancien.salaire_base]
      );

      return nouveauRows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'contrat', entityId: nouveau.id, details: { renouvelle_depuis: req.params.id }, ip: req.ip });
    res.status(201).json(nouveau);
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { equipementSchema } from './formation.schemas.js';

const router = Router();
router.use(requireStaff);

router.get(
  '/',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.salle_id) {
      params.push(req.query.salle_id);
      where.push(`eq.salle_id = $${params.length}`);
    }
    if (req.query.ecole_id) {
      params.push(req.query.ecole_id);
      where.push(`s.ecole_id = $${params.length}`);
    }
    if (req.query.etat) {
      params.push(req.query.etat);
      where.push(`eq.etat = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT eq.*, s.nom AS salle_nom, s.ecole_id, ec.nom AS ecole_nom
         FROM formation_equipements eq
         JOIN formation_salles s ON s.id = eq.salle_id
         JOIN formation_ecoles ec ON ec.id = s.ecole_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ec.nom ASC, s.nom ASC, eq.type_equipement ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT eq.*, s.nom AS salle_nom, ec.nom AS ecole_nom
         FROM formation_equipements eq
         JOIN formation_salles s ON s.id = eq.salle_id
         JOIN formation_ecoles ec ON ec.id = s.ecole_id
        WHERE eq.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Équipement introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('formation', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = equipementSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (salle, type et désignation requis)');
    const eq = parsed.data;
    const { rows: salleRows } = await query('SELECT id FROM formation_salles WHERE id = $1', [eq.salle_id]);
    if (!salleRows[0]) throw badRequest('Salle introuvable');
    const { rows } = await query(
      `INSERT INTO formation_equipements (salle_id, type_equipement, designation, numero_serie, date_installation, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [eq.salle_id, eq.type_equipement, eq.designation, eq.numero_serie || null, eq.date_installation || null, eq.notes || null]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'formation', entityType: 'equipement', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('formation', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = equipementSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const eq = parsed.data;
    const { rows } = await query(
      `UPDATE formation_equipements SET
         type_equipement = COALESCE($2, type_equipement), designation = COALESCE($3, designation),
         numero_serie = COALESCE($4, numero_serie), date_installation = COALESCE($5, date_installation),
         notes = COALESCE($6, notes), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, eq.type_equipement, eq.designation, eq.numero_serie, eq.date_installation, eq.notes]
    );
    if (!rows[0]) throw notFound('Équipement introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'equipement', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requirePermission('formation', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM formation_equipements WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw notFound('Équipement introuvable');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'formation', entityType: 'equipement', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { chapitreSchema } from './formation.schemas.js';

const router = Router();

const COUVERT_EXPR = `
  EXISTS (
    SELECT 1 FROM formation_rapports_chapitres rc
    WHERE rc.chapitre_id = c.id
  ) AS couvert,
  (SELECT MAX(s.date_seance) FROM formation_rapports_chapitres rc
     JOIN formation_rapports_cours r ON r.id = rc.rapport_id
     JOIN formation_seances s ON s.id = r.seance_id
    WHERE rc.chapitre_id = c.id) AS derniere_couverture
`;

router.get(
  '/',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.classe_id) {
      params.push(req.query.classe_id);
      where.push(`c.classe_id = $${params.length}`);
    }
    if (req.query.domaine) {
      params.push(req.query.domaine);
      where.push(`c.domaine = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT c.*, ${COUVERT_EXPR}
         FROM formation_chapitres c
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY c.domaine ASC, c.ordre ASC`,
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
      `SELECT c.*, ${COUVERT_EXPR} FROM formation_chapitres c WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Chapitre introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requireStaff,
  requirePermission('formation', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = chapitreSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (classe, domaine et titre requis)');
    const c = parsed.data;
    const { rows: classeRows } = await query('SELECT id FROM formation_classes WHERE id = $1', [c.classe_id]);
    if (!classeRows[0]) throw badRequest('Classe introuvable');
    const { rows } = await query(
      `INSERT INTO formation_chapitres (classe_id, domaine, titre, description, ordre)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [c.classe_id, c.domaine, c.titre, c.description || null, c.ordre ?? 0]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'formation', entityType: 'chapitre', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requireStaff,
  requirePermission('formation', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = chapitreSchema.partial({ classe_id: true, domaine: true, titre: true }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;
    const { rows } = await query(
      `UPDATE formation_chapitres SET
         titre = COALESCE($2, titre), description = COALESCE($3, description), ordre = COALESCE($4, ordre),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, c.titre, c.description, c.ordre]
    );
    if (!rows[0]) throw notFound('Chapitre introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'chapitre', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requireStaff,
  requirePermission('formation', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM formation_chapitres WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw notFound('Chapitre introuvable');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'formation', entityType: 'chapitre', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

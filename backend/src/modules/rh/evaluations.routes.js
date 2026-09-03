import { Router } from 'express';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { evaluationSchema } from './rh.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.employe_id) {
      params.push(req.query.employe_id);
      where.push(`ev.employe_id = $${params.length}`);
    }
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`ev.statut = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT ev.*, e.nom AS employe_nom, e.prenom AS employe_prenom, u.full_name AS evaluateur_nom
         FROM rh_evaluations ev
         JOIN rh_employes e ON e.id = ev.employe_id
         LEFT JOIN users u ON u.id = ev.evaluateur_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ev.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT ev.*, e.nom AS employe_nom, e.prenom AS employe_prenom, u.full_name AS evaluateur_nom
         FROM rh_evaluations ev
         JOIN rh_employes e ON e.id = ev.employe_id
         LEFT JOIN users u ON u.id = ev.evaluateur_id
        WHERE ev.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Évaluation introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = evaluationSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (employé et période requis)');
    const ev = parsed.data;
    try {
      const { rows } = await query(
        `INSERT INTO rh_evaluations (employe_id, evaluateur_id, periode, score, points_forts, axes_amelioration, commentaires)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [ev.employe_id, ev.evaluateur_id || req.user.id, ev.periode, ev.score ?? null, ev.points_forts || null, ev.axes_amelioration || null, ev.commentaires || null]
      );
      await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'evaluation', entityId: rows[0].id, ip: req.ip });
      res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === '23505') throw conflict('Une évaluation existe déjà pour cet employé sur cette période');
      throw err;
    }
  })
);

router.patch(
  '/:id',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = evaluationSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const ev = parsed.data;
    const { rows } = await query(
      `UPDATE rh_evaluations SET
         score = COALESCE($2, score), points_forts = COALESCE($3, points_forts),
         axes_amelioration = COALESCE($4, axes_amelioration), commentaires = COALESCE($5, commentaires),
         updated_at = now()
       WHERE id = $1 AND statut = 'brouillon' RETURNING *`,
      [req.params.id, ev.score, ev.points_forts, ev.axes_amelioration, ev.commentaires]
    );
    if (!rows[0]) throw badRequest('Seule une évaluation en brouillon peut être modifiée');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'evaluation', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/finaliser',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE rh_evaluations SET statut = 'finalisee', updated_at = now()
       WHERE id = $1 AND statut = 'brouillon' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seule une évaluation en brouillon peut être finalisée');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'evaluation', entityId: rows[0].id, details: { statut: 'finalisee' }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

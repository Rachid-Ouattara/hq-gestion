import { Router } from 'express';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { formationSchema, participantSchema } from './rh.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`f.statut = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`f.titre ILIKE $${params.length}`);
    }
    const { rows } = await query(
      `SELECT f.*, COUNT(p.id) AS nb_participants
         FROM rh_formations f
         LEFT JOIN rh_formations_participants p ON p.formation_id = f.id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        GROUP BY f.id
        ORDER BY f.date_debut DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM rh_formations WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Formation introuvable');
    const { rows: participants } = await query(
      `SELECT p.*, e.nom AS employe_nom, e.prenom AS employe_prenom, e.poste AS employe_poste
         FROM rh_formations_participants p
         JOIN rh_employes e ON e.id = p.employe_id
        WHERE p.formation_id = $1
        ORDER BY e.nom ASC`,
      [req.params.id]
    );
    res.json({ ...rows[0], participants });
  })
);

router.post(
  '/',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = formationSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (titre et dates requises)');
    const f = parsed.data;
    if (new Date(f.date_fin) < new Date(f.date_debut)) throw badRequest('La date de fin doit être postérieure à la date de début');
    const { rows } = await query(
      `INSERT INTO rh_formations (titre, organisme, lieu, date_debut, date_fin, cout, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [f.titre, f.organisme || null, f.lieu || null, f.date_debut, f.date_fin, f.cout ?? 0, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'formation', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = formationSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const f = parsed.data;
    const { rows } = await query(
      `UPDATE rh_formations SET
         titre = COALESCE($2, titre), organisme = COALESCE($3, organisme), lieu = COALESCE($4, lieu),
         date_debut = COALESCE($5, date_debut), date_fin = COALESCE($6, date_fin),
         cout = COALESCE($7, cout), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, f.titre, f.organisme, f.lieu, f.date_debut, f.date_fin, f.cout]
    );
    if (!rows[0]) throw notFound('Formation introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'formation', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.patch(
  '/:id/statut',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut;
    if (!['planifiee', 'en_cours', 'terminee', 'annulee'].includes(statut)) throw badRequest('Statut invalide');
    const { rows } = await query(
      `UPDATE rh_formations SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, statut]
    );
    if (!rows[0]) throw notFound('Formation introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'formation', entityId: rows[0].id, details: { statut }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/participants',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = participantSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Employé requis');
    const { rows: formationRows } = await query('SELECT id FROM rh_formations WHERE id = $1', [req.params.id]);
    if (!formationRows[0]) throw notFound('Formation introuvable');
    try {
      const { rows } = await query(
        `INSERT INTO rh_formations_participants (formation_id, employe_id) VALUES ($1,$2) RETURNING *`,
        [req.params.id, parsed.data.employe_id]
      );
      await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'formation_participant', entityId: rows[0].id, ip: req.ip });
      res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === '23505') throw conflict('Cet employé est déjà inscrit à cette formation');
      throw err;
    }
  })
);

router.patch(
  '/:id/participants/:participantId',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut_participation;
    if (!['inscrit', 'present', 'absent', 'certifie'].includes(statut)) throw badRequest('Statut de participation invalide');
    const { rows } = await query(
      `UPDATE rh_formations_participants SET statut_participation = $3
       WHERE id = $2 AND formation_id = $1 RETURNING *`,
      [req.params.id, req.params.participantId, statut]
    );
    if (!rows[0]) throw notFound('Participant introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'formation_participant', entityId: rows[0].id, details: { statut_participation: statut }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id/participants/:participantId',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `DELETE FROM rh_formations_participants WHERE id = $2 AND formation_id = $1 RETURNING id`,
      [req.params.id, req.params.participantId]
    );
    if (!rows[0]) throw notFound('Participant introuvable');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'rh', entityType: 'formation_participant', entityId: req.params.participantId, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

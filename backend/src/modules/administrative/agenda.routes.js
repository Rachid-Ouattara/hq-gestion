import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { agendaSchema } from './administrative.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('administrative', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`statut = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`date_debut >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`date_debut <= $${params.length}`);
    }
    const { rows } = await query(
      `SELECT * FROM administrative_agenda
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY date_debut ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('administrative', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM administrative_agenda WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Événement introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('administrative', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = agendaSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (titre, dates de début et de fin requis)');
    const e = parsed.data;
    if (new Date(e.date_fin) < new Date(e.date_debut)) throw badRequest('La date de fin doit être postérieure à la date de début');
    const { rows } = await query(
      `INSERT INTO administrative_agenda (titre, description, date_debut, date_fin, lieu, participants, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [e.titre, e.description || null, e.date_debut, e.date_fin, e.lieu || null, e.participants || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'administrative', entityType: 'agenda', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('administrative', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = agendaSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const e = parsed.data;
    const { rows } = await query(
      `UPDATE administrative_agenda SET
         titre = COALESCE($2, titre), description = COALESCE($3, description),
         date_debut = COALESCE($4, date_debut), date_fin = COALESCE($5, date_fin),
         lieu = COALESCE($6, lieu), participants = COALESCE($7, participants), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, e.titre, e.description, e.date_debut, e.date_fin, e.lieu, e.participants]
    );
    if (!rows[0]) throw notFound('Événement introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'administrative', entityType: 'agenda', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/annuler',
  requirePermission('administrative', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE administrative_agenda SET statut = 'annule', updated_at = now()
       WHERE id = $1 AND statut = 'planifie' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un événement planifié peut être annulé');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'administrative', entityType: 'agenda', entityId: rows[0].id, details: { statut: 'annule' }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

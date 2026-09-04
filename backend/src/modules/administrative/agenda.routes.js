import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { notifyUser } from '../../lib/notifications.js';
import { createMeetEvent } from '../../lib/googleCalendar.js';
import { agendaSchema } from './administrative.schemas.js';

const router = Router();

const PARTICIPANTS_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email) ORDER BY u.full_name)
       FROM administrative_agenda_participants ap JOIN users u ON u.id = ap.user_id
      WHERE ap.agenda_id = a.id),
    '[]'
  ) AS participants_internes
`;

router.get(
  '/participants-disponibles',
  requirePermission('administrative', 'read'),
  asyncHandler(async (_req, res) => {
    const { rows } = await query('SELECT id, full_name, email FROM users WHERE is_active = true ORDER BY full_name');
    res.json(rows);
  })
);

router.get(
  '/',
  requirePermission('administrative', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`a.statut = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`a.date_debut >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`a.date_debut <= $${params.length}`);
    }
    const { rows } = await query(
      `SELECT a.*, ${PARTICIPANTS_SUBQUERY}
         FROM administrative_agenda a
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY a.date_debut ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('administrative', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT a.*, ${PARTICIPANTS_SUBQUERY} FROM administrative_agenda a WHERE a.id = $1`,
      [req.params.id]
    );
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

    const participantIds = e.participant_ids || [];
    let internes = [];
    if (participantIds.length > 0) {
      const { rows } = await query('SELECT id, full_name, email FROM users WHERE id = ANY($1::uuid[])', [participantIds]);
      if (rows.length !== participantIds.length) throw badRequest('Certains participants sont introuvables');
      internes = rows;
    }

    let meetLink = null;
    let googleEventId = null;
    if (e.generer_meet) {
      const { rows: connRows } = await query('SELECT refresh_token FROM google_calendar_connexion WHERE id = 1');
      if (!connRows[0]) throw badRequest('Aucun compte Google Calendar connecté — voir Recrutement → Connexion Google Calendar.');
      const meet = await createMeetEvent({
        refreshToken: connRows[0].refresh_token,
        summary: e.titre,
        description: e.description || '',
        startDateTime: e.date_debut,
        endDateTime: e.date_fin,
        attendeeEmails: internes.filter((u) => u.email).map((u) => u.email),
      });
      meetLink = meet.meetLink;
      googleEventId = meet.eventId;
    }

    const agenda = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO administrative_agenda (titre, description, date_debut, date_fin, lieu, participants, created_by, google_event_id, meet_link)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [e.titre, e.description || null, e.date_debut, e.date_fin, e.lieu || null, e.participants || null, req.user.id, googleEventId, meetLink]
      );
      const created = rows[0];

      for (const p of internes) {
        await client.query(
          `INSERT INTO administrative_agenda_participants (agenda_id, user_id) VALUES ($1,$2)`,
          [created.id, p.id]
        );
        if (p.id !== req.user.id) {
          await notifyUser(client, {
            userId: p.id,
            titre: 'Nouvel événement à votre agenda',
            message: `« ${created.titre} » — ${new Date(created.date_debut).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`,
            moduleCode: 'administrative',
            entityType: 'agenda',
            entityId: created.id,
          });
        }
      }

      return created;
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'administrative', entityType: 'agenda', entityId: agenda.id, ip: req.ip });
    res.status(201).json({ ...agenda, participants_internes: internes });
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
  '/:id/terminer',
  requirePermission('administrative', 'update'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE administrative_agenda SET statut = 'termine', updated_at = now()
       WHERE id = $1 AND statut = 'planifie' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un événement planifié peut être marqué terminé');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'administrative', entityType: 'agenda', entityId: rows[0].id, details: { statut: 'termine' }, ip: req.ip });
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

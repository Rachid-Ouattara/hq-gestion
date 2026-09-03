import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { submitForValidation, decideValidation, getEntityStatus } from '../../lib/validationWorkflow.js';
import { notifyRole } from '../../lib/notifications.js';
import { congeSchema, decisionSchema } from './rh.schemas.js';
import { resolveActingEmploye } from './scope.js';

const router = Router();
const ENTITY_TYPE = 'conge';

router.get(
  '/',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingEmploye(req);
    const params = [];
    const where = [];
    if (acting) {
      params.push([acting.employeId, ...acting.subordinateIds]);
      where.push(`c.employe_id = ANY($${params.length})`);
    } else if (req.query.employe_id) {
      params.push(req.query.employe_id);
      where.push(`c.employe_id = $${params.length}`);
    }
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`c.statut = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT c.*, e.nom AS employe_nom, e.prenom AS employe_prenom
         FROM rh_conges c
         JOIN rh_employes e ON e.id = c.employe_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY c.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingEmploye(req);
    const { rows } = await query(
      `SELECT c.*, e.nom AS employe_nom, e.prenom AS employe_prenom
         FROM rh_conges c JOIN rh_employes e ON e.id = c.employe_id
        WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Demande de congé introuvable');
    if (acting && ![acting.employeId, ...acting.subordinateIds].includes(rows[0].employe_id)) {
      throw notFound('Demande de congé introuvable');
    }
    const validation = await getEntityStatus({ moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: req.params.id });
    res.json({ ...rows[0], validation });
  })
);

router.post(
  '/',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingEmploye(req);
    const parsed = congeSchema.safeParse({ ...req.body, employe_id: acting ? acting.employeId : req.body.employe_id });
    if (!parsed.success) throw badRequest('Champs invalides (employé, type, dates et nombre de jours requis)');
    const c = parsed.data;
    if (new Date(c.date_fin) < new Date(c.date_debut)) throw badRequest('La date de fin doit être postérieure à la date de début');
    const { rows } = await query(
      `INSERT INTO rh_conges (employe_id, type_conge, date_debut, date_fin, nombre_jours, motif, demandeur_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [c.employe_id, c.type_conge, c.date_debut, c.date_fin, c.nombre_jours, c.motif || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingEmploye(req);
    if (acting) {
      const { rows: own } = await query('SELECT employe_id FROM rh_conges WHERE id = $1', [req.params.id]);
      if (!own[0] || own[0].employe_id !== acting.employeId) throw notFound('Demande de congé introuvable');
    }
    const parsed = congeSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;
    const { rows } = await query(
      `UPDATE rh_conges SET
         type_conge = COALESCE($2, type_conge), date_debut = COALESCE($3, date_debut),
         date_fin = COALESCE($4, date_fin), nombre_jours = COALESCE($5, nombre_jours),
         motif = COALESCE($6, motif), updated_at = now()
       WHERE id = $1 AND statut = 'brouillon' RETURNING *`,
      [req.params.id, c.type_conge, c.date_debut, c.date_fin, c.nombre_jours, c.motif]
    );
    if (!rows[0]) throw badRequest('Seule une demande en brouillon peut être modifiée');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requirePermission('rh', 'delete'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingEmploye(req);
    if (acting) {
      const { rows: own } = await query('SELECT employe_id FROM rh_conges WHERE id = $1', [req.params.id]);
      if (!own[0] || own[0].employe_id !== acting.employeId) throw notFound('Demande de congé introuvable');
    }
    const { rows } = await query(
      `DELETE FROM rh_conges WHERE id = $1 AND statut = 'brouillon' RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seule une demande en brouillon peut être supprimée');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

router.post(
  '/:id/soumettre',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingEmploye(req);
    const conge = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT c.*, e.nom AS employe_nom, e.prenom AS employe_prenom
           FROM rh_conges c JOIN rh_employes e ON e.id = c.employe_id
          WHERE c.id = $1 FOR UPDATE OF c`,
        [req.params.id]
      );
      if (!rows[0]) throw notFound('Demande introuvable');
      if (acting && rows[0].employe_id !== acting.employeId) throw notFound('Demande introuvable');
      if (rows[0].statut !== 'brouillon') throw badRequest('Seule une demande en brouillon peut être soumise');

      await submitForValidation({ moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: req.params.id, userId: req.user.id });
      const { rows: updated } = await client.query(
        `UPDATE rh_conges SET statut = 'soumise', updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      await notifyRole(client, {
        roleCode: 'direction',
        titre: 'Congé à valider',
        message: `${rows[0].employe_nom} ${rows[0].employe_prenom} a soumis une demande de congé (${updated[0].numero}).`,
        moduleCode: 'rh',
        entityType: ENTITY_TYPE,
        entityId: req.params.id,
      });
      return updated[0];
    });

    await logAudit({ userId: req.user.id, action: 'submit', moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: conge.id, ip: req.ip });
    res.json(conge);
  })
);

router.post(
  '/:id/decider',
  requirePermission('rh', 'validate'),
  asyncHandler(async (req, res) => {
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("La décision doit être 'validated' ou 'rejected'");
    const { decision, comment } = parsed.data;

    const pending = await getEntityStatus({ moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: req.params.id });
    if (!pending || pending.status !== 'submitted') throw badRequest('Aucune demande de validation en attente pour cette demande');

    const conge = await withTransaction(async (client) => {
      await decideValidation({ validationId: pending.id, decision, userId: req.user.id, comment });
      const { rows } = await client.query(
        `UPDATE rh_conges SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id, decision === 'validated' ? 'validee' : 'rejetee']
      );
      return rows[0];
    });

    await logAudit({
      userId: req.user.id,
      action: decision === 'validated' ? 'validate' : 'reject',
      moduleCode: 'rh',
      entityType: ENTITY_TYPE,
      entityId: conge.id,
      ip: req.ip,
    });
    res.json(conge);
  })
);

export default router;

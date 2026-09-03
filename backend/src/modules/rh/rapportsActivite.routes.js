import { Router } from 'express';
import { asyncHandler, badRequest, forbidden, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { submitForValidation, decideValidation, getEntityStatus } from '../../lib/validationWorkflow.js';
import { notifyRole, notifyUser } from '../../lib/notifications.js';
import { rapportActiviteSchema, commentaireResponsableSchema, decisionSchema } from './rh.schemas.js';
import { resolveActingEmploye } from './scope.js';

const router = Router();
const ENTITY_TYPE = 'rapport_activite';

const SELECT_BASE = `
  SELECT r.*, e.nom AS employe_nom, e.prenom AS employe_prenom, e.responsable_id,
         u.full_name AS lu_par_nom
    FROM rh_rapports_activite r
    JOIN rh_employes e ON e.id = r.employe_id
    LEFT JOIN users u ON u.id = r.lu_par
`;

router.get(
  '/',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingEmploye(req);
    const params = [];
    const where = [];
    if (acting) {
      params.push([acting.employeId, ...acting.subordinateIds]);
      where.push(`r.employe_id = ANY($${params.length})`);
    } else if (req.query.employe_id) {
      params.push(req.query.employe_id);
      where.push(`r.employe_id = $${params.length}`);
    }
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`r.statut = $${params.length}`);
    }
    const { rows } = await query(
      `${SELECT_BASE}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY r.created_at DESC`,
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
    const { rows } = await query(`${SELECT_BASE} WHERE r.id = $1`, [req.params.id]);
    if (!rows[0]) throw notFound("Rapport d'activité introuvable");
    if (acting && ![acting.employeId, ...acting.subordinateIds].includes(rows[0].employe_id)) {
      throw notFound("Rapport d'activité introuvable");
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
    const parsed = rapportActiviteSchema.safeParse({ ...req.body, employe_id: acting ? acting.employeId : req.body.employe_id });
    if (!parsed.success) throw badRequest('Champs invalides (période et contenu requis)');
    const r = parsed.data;
    if (!r.employe_id) throw badRequest('employe_id requis');
    if (new Date(r.periode_fin) < new Date(r.periode_debut)) throw badRequest('La période de fin doit être postérieure à la période de début');
    const { rows } = await query(
      `INSERT INTO rh_rapports_activite (employe_id, periode_debut, periode_fin, contenu, difficultes)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [r.employe_id, r.periode_debut, r.periode_fin, r.contenu, r.difficultes || null]
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
      const { rows: own } = await query('SELECT employe_id FROM rh_rapports_activite WHERE id = $1', [req.params.id]);
      if (!own[0] || own[0].employe_id !== acting.employeId) throw notFound("Rapport d'activité introuvable");
    }
    const parsed = rapportActiviteSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const r = parsed.data;
    const { rows } = await query(
      `UPDATE rh_rapports_activite SET
         periode_debut = COALESCE($2, periode_debut), periode_fin = COALESCE($3, periode_fin),
         contenu = COALESCE($4, contenu), difficultes = COALESCE($5, difficultes), updated_at = now()
       WHERE id = $1 AND statut = 'brouillon' RETURNING *`,
      [req.params.id, r.periode_debut, r.periode_fin, r.contenu, r.difficultes]
    );
    if (!rows[0]) throw badRequest('Seul un rapport en brouillon peut être modifié');
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
      const { rows: own } = await query('SELECT employe_id FROM rh_rapports_activite WHERE id = $1', [req.params.id]);
      if (!own[0] || own[0].employe_id !== acting.employeId) throw notFound("Rapport d'activité introuvable");
    }
    const { rows } = await query(
      `DELETE FROM rh_rapports_activite WHERE id = $1 AND statut = 'brouillon' RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un rapport en brouillon peut être supprimé');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

router.post(
  '/:id/soumettre',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingEmploye(req);
    const rapport = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT r.*, e.nom AS employe_nom, e.prenom AS employe_prenom, e.responsable_id
           FROM rh_rapports_activite r JOIN rh_employes e ON e.id = r.employe_id
          WHERE r.id = $1 FOR UPDATE OF r`,
        [req.params.id]
      );
      if (!rows[0]) throw notFound('Rapport introuvable');
      if (acting && rows[0].employe_id !== acting.employeId) throw notFound('Rapport introuvable');
      if (rows[0].statut !== 'brouillon') throw badRequest('Seul un rapport en brouillon peut être soumis');

      await submitForValidation({ moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: req.params.id, userId: req.user.id });
      const { rows: updated } = await client.query(
        `UPDATE rh_rapports_activite SET statut = 'soumis', updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id]
      );

      let responsableUserId = null;
      if (rows[0].responsable_id) {
        const { rows: respRows } = await client.query('SELECT user_id FROM rh_employes WHERE id = $1', [rows[0].responsable_id]);
        responsableUserId = respRows[0]?.user_id || null;
      }
      const titre = "Rapport d'activité à suivre";
      const message = `${rows[0].employe_nom} ${rows[0].employe_prenom} a soumis un rapport d'activité (${updated[0].numero}).`;
      if (responsableUserId) {
        await notifyUser(client, { userId: responsableUserId, titre, message, moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: req.params.id });
      } else {
        await notifyRole(client, { roleCode: 'direction', titre, message, moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: req.params.id });
      }
      return updated[0];
    });

    await logAudit({ userId: req.user.id, action: 'submit', moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: rapport.id, ip: req.ip });
    res.json(rapport);
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
    if (!pending || pending.status !== 'submitted') throw badRequest('Aucune demande de validation en attente pour ce rapport');

    const rapport = await withTransaction(async (client) => {
      await decideValidation({ validationId: pending.id, decision, userId: req.user.id, comment });
      const { rows } = await client.query(
        `UPDATE rh_rapports_activite SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id, decision === 'validated' ? 'valide' : 'rejete']
      );
      return rows[0];
    });

    await logAudit({
      userId: req.user.id,
      action: decision === 'validated' ? 'validate' : 'reject',
      moduleCode: 'rh',
      entityType: ENTITY_TYPE,
      entityId: rapport.id,
      ip: req.ip,
    });
    res.json(rapport);
  })
);

router.post(
  '/:id/commenter',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingEmploye(req);
    const { rows: current } = await query(
      `SELECT r.employe_id, e.responsable_id FROM rh_rapports_activite r JOIN rh_employes e ON e.id = r.employe_id WHERE r.id = $1`,
      [req.params.id]
    );
    if (!current[0]) throw notFound('Rapport introuvable');
    if (acting && current[0].responsable_id !== acting.employeId) throw forbidden("Réservé au responsable de l'employé");

    const parsed = commentaireResponsableSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const { rows } = await query(
      `UPDATE rh_rapports_activite SET commentaire_responsable = $2, lu_par = $3, lu_le = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, parsed.data.commentaire_responsable || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: ENTITY_TYPE, entityId: rows[0].id, details: { commentaire: true }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

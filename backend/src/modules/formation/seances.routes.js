import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { seanceSchema } from './formation.schemas.js';
import { resolveActingFormateur } from './scope.js';

const router = Router();

const SELECT_BASE = `
  SELECT s.*, e.nom AS ecole_nom, sa.nom AS salle_nom, c.nom AS camp_nom, cl.nom AS classe_nom,
         emp.nom AS formateur_nom, emp.prenom AS formateur_prenom
    FROM formation_seances s
    LEFT JOIN formation_ecoles e ON e.id = s.ecole_id
    LEFT JOIN formation_salles sa ON sa.id = s.salle_id
    LEFT JOIN formation_camps c ON c.id = s.camp_id
    LEFT JOIN formation_classes cl ON cl.id = s.classe_id
    JOIN rh_employes emp ON emp.id = s.formateur_id
`;

router.get(
  '/',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingFormateur(req);
    const params = [];
    const where = [];

    if (acting) {
      params.push(acting.employeId);
      where.push(`s.formateur_id = $${params.length}`);
    } else {
      if (req.query.formateur_id) {
        params.push(req.query.formateur_id);
        where.push(`s.formateur_id = $${params.length}`);
      }
      if (req.query.ecole_id) {
        params.push(req.query.ecole_id);
        where.push(`s.ecole_id = $${params.length}`);
      }
      if (req.query.camp_id) {
        params.push(req.query.camp_id);
        where.push(`s.camp_id = $${params.length}`);
      }
      if (req.query.domaine) {
        params.push(req.query.domaine);
        where.push(`s.domaine = $${params.length}`);
      }
      if (req.query.statut) {
        params.push(req.query.statut);
        where.push(`s.statut = $${params.length}`);
      }
      if (req.query.date_from) {
        params.push(req.query.date_from);
        where.push(`s.date_seance >= $${params.length}`);
      }
      if (req.query.date_to) {
        params.push(req.query.date_to);
        where.push(`s.date_seance <= $${params.length}`);
      }
    }

    const { rows } = await query(
      `${SELECT_BASE} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.date_seance DESC, s.heure_debut DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingFormateur(req);
    const { rows } = await query(`${SELECT_BASE} WHERE s.id = $1`, [req.params.id]);
    if (!rows[0]) throw notFound('Séance introuvable');
    if (acting && rows[0].formateur_id !== acting.employeId) throw notFound('Séance introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('formation', 'create'),
  requireStaff,
  asyncHandler(async (req, res) => {
    const parsed = seanceSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const s = parsed.data;
    if (s.heure_fin <= s.heure_debut) throw badRequest("L'heure de fin doit être postérieure à l'heure de début");
    if (s.lieu_type === 'ecole' && (!s.ecole_id || !s.salle_id)) throw badRequest('École et salle requises pour une séance en école');
    if (s.lieu_type === 'camp' && !s.camp_id) throw badRequest('Camp requis pour une séance en camp');

    const { rows } = await query(
      `INSERT INTO formation_seances
         (date_seance, heure_debut, heure_fin, lieu_type, ecole_id, salle_id, camp_id, domaine, formateur_id, classe_id, groupe, effectif_prevu, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        s.date_seance, s.heure_debut, s.heure_fin, s.lieu_type,
        s.lieu_type === 'ecole' ? s.ecole_id : null,
        s.lieu_type === 'ecole' ? s.salle_id : null,
        s.lieu_type === 'camp' ? s.camp_id : null,
        s.domaine, s.formateur_id,
        s.lieu_type === 'ecole' ? s.classe_id || null : null,
        s.groupe || null, s.effectif_prevu ?? null, s.notes || null, req.user.id,
      ]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'formation', entityType: 'seance', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('formation', 'update'),
  requireStaff,
  asyncHandler(async (req, res) => {
    const parsed = seanceSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const s = parsed.data;
    const { rows } = await query(
      `UPDATE formation_seances SET
         date_seance = COALESCE($2, date_seance), heure_debut = COALESCE($3, heure_debut), heure_fin = COALESCE($4, heure_fin),
         domaine = COALESCE($5, domaine), formateur_id = COALESCE($6, formateur_id), classe_id = COALESCE($7, classe_id),
         groupe = COALESCE($8, groupe), effectif_prevu = COALESCE($9, effectif_prevu), notes = COALESCE($10, notes),
         updated_at = now()
       WHERE id = $1 AND statut = 'planifiee' RETURNING *`,
      [req.params.id, s.date_seance, s.heure_debut, s.heure_fin, s.domaine, s.formateur_id, s.classe_id, s.groupe, s.effectif_prevu, s.notes]
    );
    if (!rows[0]) throw badRequest('Seule une séance planifiée peut être modifiée');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'seance', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/annuler',
  requirePermission('formation', 'update'),
  requireStaff,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE formation_seances SET statut = 'annulee', updated_at = now()
       WHERE id = $1 AND statut = 'planifiee' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seule une séance planifiée peut être annulée');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'seance', entityId: rows[0].id, details: { statut: 'annulee' }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requirePermission('formation', 'delete'),
  requireStaff,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `DELETE FROM formation_seances WHERE id = $1 AND statut = 'planifiee' RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seule une séance planifiée peut être supprimée');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'formation', entityType: 'seance', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

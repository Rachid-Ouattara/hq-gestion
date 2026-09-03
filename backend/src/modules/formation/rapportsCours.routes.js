import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { rapportCoursSchema } from './formation.schemas.js';
import { resolveActingFormateur } from './scope.js';
import { notifyRole } from '../../lib/notifications.js';

const router = Router();

const SELECT_BASE = `
  SELECT r.*, s.numero AS seance_numero, s.date_seance, s.domaine, s.ecole_id, s.camp_id, s.classe_id,
         emp.nom AS formateur_nom, emp.prenom AS formateur_prenom, u.full_name AS lu_par_nom,
         COALESCE(
           (SELECT json_agg(json_build_object('id', ch.id, 'titre', ch.titre, 'ordre', ch.ordre) ORDER BY ch.ordre)
              FROM formation_rapports_chapitres rc
              JOIN formation_chapitres ch ON ch.id = rc.chapitre_id
             WHERE rc.rapport_id = r.id),
           '[]'
         ) AS chapitres
    FROM formation_rapports_cours r
    JOIN formation_seances s ON s.id = r.seance_id
    JOIN rh_employes emp ON emp.id = r.formateur_id
    LEFT JOIN users u ON u.id = r.lu_par
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
      where.push(`r.formateur_id = $${params.length}`);
    } else {
      if (req.query.formateur_id) {
        params.push(req.query.formateur_id);
        where.push(`r.formateur_id = $${params.length}`);
      }
      if (req.query.statut) {
        params.push(req.query.statut);
        where.push(`r.statut = $${params.length}`);
      }
    }

    const { rows } = await query(
      `${SELECT_BASE} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.created_at DESC`,
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
    const { rows } = await query(`${SELECT_BASE} WHERE r.id = $1`, [req.params.id]);
    if (!rows[0]) throw notFound('Rapport introuvable');
    if (acting && rows[0].formateur_id !== acting.employeId) throw notFound('Rapport introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('formation', 'create'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingFormateur(req);
    const parsed = rapportCoursSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (séance et contenu requis)');
    const r = parsed.data;

    const rapport = await withTransaction(async (client) => {
      const { rows: seanceRows } = await client.query(
        `SELECT s.*, e.nom AS formateur_nom, e.prenom AS formateur_prenom
           FROM formation_seances s JOIN rh_employes e ON e.id = s.formateur_id
          WHERE s.id = $1 FOR UPDATE OF s`,
        [r.seance_id]
      );
      if (!seanceRows[0]) throw badRequest('Séance introuvable');
      const seance = seanceRows[0];
      if (acting && seance.formateur_id !== acting.employeId) throw notFound('Séance introuvable');
      if (seance.statut === 'annulee') throw badRequest('Impossible de rédiger un rapport pour une séance annulée');

      const { rows } = await client.query(
        `INSERT INTO formation_rapports_cours (seance_id, formateur_id, contenu, effectif_reel, difficultes)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [r.seance_id, seance.formateur_id, r.contenu, r.effectif_reel ?? null, r.difficultes || null]
      );
      await client.query(
        `UPDATE formation_seances SET statut = 'realisee', updated_at = now() WHERE id = $1 AND statut = 'planifiee'`,
        [r.seance_id]
      );

      if (r.chapitre_ids && r.chapitre_ids.length > 0) {
        if (!seance.classe_id) throw badRequest('Cette séance n\'est rattachée à aucune classe, aucun chapitre ne peut être coché');
        const { rows: chapitreRows } = await client.query(
          `SELECT id FROM formation_chapitres WHERE id = ANY($1::uuid[]) AND classe_id = $2 AND domaine = $3`,
          [r.chapitre_ids, seance.classe_id, seance.domaine]
        );
        if (chapitreRows.length !== r.chapitre_ids.length) {
          throw badRequest('Un ou plusieurs chapitres ne correspondent pas à la classe/au domaine de cette séance');
        }
        for (const chapitreId of r.chapitre_ids) {
          await client.query(
            'INSERT INTO formation_rapports_chapitres (rapport_id, chapitre_id) VALUES ($1, $2)',
            [rows[0].id, chapitreId]
          );
        }
      }
      await notifyRole(client, {
        roleCode: 'direction',
        titre: 'Rapport de cours à lire',
        message: `${seance.formateur_nom} ${seance.formateur_prenom} a soumis un rapport de cours (${rows[0].numero}).`,
        moduleCode: 'formation',
        entityType: 'rapport_cours',
        entityId: rows[0].id,
      });
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'formation', entityType: 'rapport_cours', entityId: rapport.id, ip: req.ip });
    res.status(201).json(rapport);
  })
);

router.patch(
  '/:id',
  requirePermission('formation', 'update'),
  asyncHandler(async (req, res) => {
    const acting = await resolveActingFormateur(req);
    const parsed = rapportCoursSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const r = parsed.data;

    const { rows: current } = await query(
      `SELECT rc.*, s.classe_id, s.domaine FROM formation_rapports_cours rc
         JOIN formation_seances s ON s.id = rc.seance_id
        WHERE rc.id = $1`,
      [req.params.id]
    );
    if (!current[0]) throw notFound('Rapport introuvable');
    if (acting && current[0].formateur_id !== acting.employeId) throw notFound('Rapport introuvable');
    if (current[0].statut !== 'soumis') throw badRequest('Seul un rapport non lu peut être modifié');

    const rapport = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE formation_rapports_cours SET
           contenu = COALESCE($2, contenu), effectif_reel = COALESCE($3, effectif_reel), difficultes = COALESCE($4, difficultes),
           updated_at = now()
         WHERE id = $1 RETURNING *`,
        [req.params.id, r.contenu, r.effectif_reel, r.difficultes]
      );

      if (r.chapitre_ids) {
        if (r.chapitre_ids.length > 0) {
          if (!current[0].classe_id) throw badRequest('Cette séance n\'est rattachée à aucune classe, aucun chapitre ne peut être coché');
          const { rows: chapitreRows } = await client.query(
            `SELECT id FROM formation_chapitres WHERE id = ANY($1::uuid[]) AND classe_id = $2 AND domaine = $3`,
            [r.chapitre_ids, current[0].classe_id, current[0].domaine]
          );
          if (chapitreRows.length !== r.chapitre_ids.length) {
            throw badRequest('Un ou plusieurs chapitres ne correspondent pas à la classe/au domaine de cette séance');
          }
        }
        await client.query('DELETE FROM formation_rapports_chapitres WHERE rapport_id = $1', [req.params.id]);
        for (const chapitreId of r.chapitre_ids) {
          await client.query(
            'INSERT INTO formation_rapports_chapitres (rapport_id, chapitre_id) VALUES ($1, $2)',
            [req.params.id, chapitreId]
          );
        }
      }

      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'rapport_cours', entityId: rapport.id, ip: req.ip });
    res.json(rapport);
  })
);

router.post(
  '/:id/lire',
  requirePermission('formation', 'update'),
  requireStaff,
  asyncHandler(async (req, res) => {
    const commentaire = req.body?.commentaire_rh || null;
    const { rows } = await query(
      `UPDATE formation_rapports_cours SET statut = 'lu', lu_par = $2, lu_at = now(), commentaire_rh = $3, updated_at = now()
       WHERE id = $1 AND statut = 'soumis' RETURNING *`,
      [req.params.id, req.user.id, commentaire]
    );
    if (!rows[0]) throw badRequest('Ce rapport a déjà été marqué comme lu');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'rapport_cours', entityId: rows[0].id, details: { statut: 'lu' }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requirePermission('formation', 'delete'),
  requireStaff,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `DELETE FROM formation_rapports_cours WHERE id = $1 AND statut = 'soumis' RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seul un rapport non lu peut être supprimé');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'formation', entityType: 'rapport_cours', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

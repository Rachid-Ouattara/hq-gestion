import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { visiteSchema, constatSchema } from './formation.schemas.js';

const router = Router();
router.use(requireStaff);

router.get(
  '/echeancier',
  requirePermission('formation', 'read'),
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT s.id AS salle_id, s.nom AS salle_nom, s.ecole_id, e.nom AS ecole_nom, s.frequence_maintenance_mois,
              MAX(v.date_visite) FILTER (WHERE v.statut = 'realisee') AS derniere_visite,
              COALESCE(
                MAX(v.date_visite) FILTER (WHERE v.statut = 'realisee') + (s.frequence_maintenance_mois || ' months')::interval,
                CURRENT_DATE
              )::date AS prochaine_echeance
         FROM formation_salles s
         JOIN formation_ecoles e ON e.id = s.ecole_id
         LEFT JOIN formation_maintenance_visites v ON v.salle_id = s.id
        WHERE s.frequence_maintenance_mois IS NOT NULL
        GROUP BY s.id, s.nom, s.ecole_id, e.nom, s.frequence_maintenance_mois
        ORDER BY prochaine_echeance ASC`
    );
    res.json(rows);
  })
);

router.get(
  '/visites',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.ecole_id) {
      params.push(req.query.ecole_id);
      where.push(`v.ecole_id = $${params.length}`);
    }
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`v.statut = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT v.*, e.nom AS ecole_nom, s.nom AS salle_nom, t.nom AS technicien_nom, t.prenom AS technicien_prenom
         FROM formation_maintenance_visites v
         JOIN formation_ecoles e ON e.id = v.ecole_id
         LEFT JOIN formation_salles s ON s.id = v.salle_id
         LEFT JOIN rh_employes t ON t.id = v.technicien_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY v.date_visite DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/visites/:id',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT v.*, e.nom AS ecole_nom, s.nom AS salle_nom, t.nom AS technicien_nom, t.prenom AS technicien_prenom
         FROM formation_maintenance_visites v
         JOIN formation_ecoles e ON e.id = v.ecole_id
         LEFT JOIN formation_salles s ON s.id = v.salle_id
         LEFT JOIN rh_employes t ON t.id = v.technicien_id
        WHERE v.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Visite introuvable');
    const { rows: constats } = await query(
      `SELECT c.*, eq.designation AS equipement_designation, eq.type_equipement
         FROM formation_maintenance_constats c
         JOIN formation_equipements eq ON eq.id = c.equipement_id
        WHERE c.visite_id = $1
        ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json({ ...rows[0], constats });
  })
);

router.post(
  '/visites',
  requirePermission('formation', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = visiteSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (école requise)');
    const v = parsed.data;
    const { rows } = await query(
      `INSERT INTO formation_maintenance_visites (ecole_id, salle_id, date_visite, technicien_id, notes, created_by)
       VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5,$6)
       RETURNING *`,
      [v.ecole_id, v.salle_id || null, v.date_visite || null, v.technicien_id || null, v.notes || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'formation', entityType: 'maintenance_visite', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/visites/:id/statut',
  requirePermission('formation', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut;
    if (!['planifiee', 'realisee'].includes(statut)) throw badRequest('Statut invalide');
    const { rows } = await query(
      `UPDATE formation_maintenance_visites SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, statut]
    );
    if (!rows[0]) throw notFound('Visite introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'maintenance_visite', entityId: rows[0].id, details: { statut }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/visites/:id/constats',
  requirePermission('formation', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = constatSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (équipement et panne constatée requis)');
    const c = parsed.data;

    const constat = await withTransaction(async (client) => {
      const { rows: visiteRows } = await client.query('SELECT id FROM formation_maintenance_visites WHERE id = $1', [req.params.id]);
      if (!visiteRows[0]) throw badRequest('Visite introuvable');

      const { rows } = await client.query(
        `INSERT INTO formation_maintenance_constats (visite_id, equipement_id, panne_constatee, solution)
         VALUES ($1,$2,$3,$4)
         RETURNING *`,
        [req.params.id, c.equipement_id, c.panne_constatee, c.solution || null]
      );
      await client.query(
        `UPDATE formation_equipements SET etat = 'en_panne', updated_at = now()
         WHERE id = $1 AND etat = 'fonctionnel'`,
        [c.equipement_id]
      );
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'formation', entityType: 'maintenance_constat', entityId: constat.id, ip: req.ip });
    res.status(201).json(constat);
  })
);

router.patch(
  '/constats/:id/statut',
  requirePermission('formation', 'update'),
  asyncHandler(async (req, res) => {
    const statut = req.body?.statut;
    if (!['signale', 'en_cours', 'resolu'].includes(statut)) throw badRequest('Statut invalide');

    const constat = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE formation_maintenance_constats SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id, statut]
      );
      if (!rows[0]) throw notFound('Constat introuvable');

      if (statut === 'en_cours') {
        await client.query(
          `UPDATE formation_equipements SET etat = 'en_reparation', updated_at = now() WHERE id = $1`,
          [rows[0].equipement_id]
        );
      } else if (statut === 'resolu') {
        const { rows: pending } = await client.query(
          `SELECT 1 FROM formation_maintenance_constats WHERE equipement_id = $1 AND statut != 'resolu' AND id != $2 LIMIT 1`,
          [rows[0].equipement_id, rows[0].id]
        );
        if (!pending[0]) {
          await client.query(
            `UPDATE formation_equipements SET etat = 'fonctionnel', updated_at = now() WHERE id = $1`,
            [rows[0].equipement_id]
          );
        }
      }
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'maintenance_constat', entityId: constat.id, details: { statut }, ip: req.ip });
    res.json(constat);
  })
);

export default router;

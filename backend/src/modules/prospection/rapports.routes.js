import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { rapportSchema } from './prospection.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('prospection', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.ecole_cible_id) {
      params.push(req.query.ecole_cible_id);
      where.push(`r.ecole_cible_id = $${params.length}`);
    }
    if (req.query.campagne_id) {
      params.push(req.query.campagne_id);
      where.push(`e.campagne_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT r.*, e.nom AS ecole_nom, e.statut AS ecole_statut, c.nom AS campagne_nom, u.full_name AS redige_par_nom
         FROM prospection_rapports r
         JOIN prospection_ecoles_cibles e ON e.id = r.ecole_cible_id
         JOIN prospection_campagnes c ON c.id = e.campagne_id
         LEFT JOIN users u ON u.id = r.redige_par
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY r.date_contact DESC, r.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('prospection', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT r.*, e.nom AS ecole_nom, u.full_name AS redige_par_nom
         FROM prospection_rapports r
         JOIN prospection_ecoles_cibles e ON e.id = r.ecole_cible_id
         LEFT JOIN users u ON u.id = r.redige_par
        WHERE r.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Rapport introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('prospection', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = rapportSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (école et résumé requis)');
    const r = parsed.data;
    const created = await withTransaction(async (client) => {
      const { rows: ecoleRows } = await client.query('SELECT id FROM prospection_ecoles_cibles WHERE id = $1 FOR UPDATE', [r.ecole_cible_id]);
      if (!ecoleRows[0]) throw badRequest('École cible introuvable');
      const { rows } = await client.query(
        `INSERT INTO prospection_rapports (ecole_cible_id, date_contact, resume, resultat, prochaine_action, redige_par)
         VALUES ($1,COALESCE($2, CURRENT_DATE),$3,$4,$5,$6)
         RETURNING *`,
        [r.ecole_cible_id, r.date_contact || null, r.resume, r.resultat || null, r.prochaine_action || null, req.user.id]
      );
      if (r.date_relance) {
        await client.query(
          'UPDATE prospection_ecoles_cibles SET date_relance = $2, updated_at = now() WHERE id = $1',
          [r.ecole_cible_id, r.date_relance]
        );
      }
      return rows[0];
    });
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'prospection', entityType: 'rapport', entityId: created.id, ip: req.ip });
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  requirePermission('prospection', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = rapportSchema.partial({ ecole_cible_id: true }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const r = parsed.data;
    const { rows } = await query(
      `UPDATE prospection_rapports SET
         date_contact = COALESCE($2, date_contact), resume = COALESCE($3, resume),
         resultat = COALESCE($4, resultat), prochaine_action = COALESCE($5, prochaine_action), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, r.date_contact, r.resume, r.resultat, r.prochaine_action]
    );
    if (!rows[0]) throw notFound('Rapport introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'prospection', entityType: 'rapport', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requirePermission('prospection', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM prospection_rapports WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw notFound('Rapport introuvable');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'prospection', entityType: 'rapport', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

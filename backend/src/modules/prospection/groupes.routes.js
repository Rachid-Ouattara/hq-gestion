import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { groupeSchema, membresSchema } from './prospection.schemas.js';

const router = Router();

router.get(
  '/',
  requirePermission('prospection', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.campagne_id) {
      params.push(req.query.campagne_id);
      where.push(`g.campagne_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT g.*, c.nom AS campagne_nom, COUNT(DISTINCT m.employe_id) AS nb_membres
         FROM prospection_groupes g
         JOIN prospection_campagnes c ON c.id = g.campagne_id
         LEFT JOIN prospection_groupes_membres m ON m.groupe_id = g.id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        GROUP BY g.id, c.nom
        ORDER BY g.nom ASC`,
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
      `SELECT g.*, c.nom AS campagne_nom FROM prospection_groupes g JOIN prospection_campagnes c ON c.id = g.campagne_id WHERE g.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Groupe introuvable');
    const { rows: membres } = await query(
      `SELECT m.employe_id, e.nom, e.prenom, e.poste
         FROM prospection_groupes_membres m
         JOIN rh_employes e ON e.id = m.employe_id
        WHERE m.groupe_id = $1
        ORDER BY e.nom ASC`,
      [req.params.id]
    );
    res.json({ ...rows[0], membres });
  })
);

router.post(
  '/',
  requirePermission('prospection', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = groupeSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (campagne et nom requis)');
    const g = parsed.data;
    const { rows: campRows } = await query('SELECT id FROM prospection_campagnes WHERE id = $1', [g.campagne_id]);
    if (!campRows[0]) throw badRequest('Campagne introuvable');
    const { rows } = await query(
      `INSERT INTO prospection_groupes (campagne_id, nom) VALUES ($1,$2) RETURNING *`,
      [g.campagne_id, g.nom]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'prospection', entityType: 'groupe', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('prospection', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = groupeSchema.partial({ campagne_id: true }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const g = parsed.data;
    const { rows } = await query(
      `UPDATE prospection_groupes SET nom = COALESCE($2, nom), updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, g.nom]
    );
    if (!rows[0]) throw notFound('Groupe introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'prospection', entityType: 'groupe', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requirePermission('prospection', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM prospection_groupes WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw notFound('Groupe introuvable');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'prospection', entityType: 'groupe', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

router.put(
  '/:id/membres',
  requirePermission('prospection', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = membresSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Liste de membres invalide');
    const { employe_ids } = parsed.data;

    const { rows: groupeRows } = await query('SELECT id FROM prospection_groupes WHERE id = $1', [req.params.id]);
    if (!groupeRows[0]) throw notFound('Groupe introuvable');

    await withTransaction(async (client) => {
      await client.query('DELETE FROM prospection_groupes_membres WHERE groupe_id = $1', [req.params.id]);
      for (const employeId of employe_ids) {
        await client.query(
          'INSERT INTO prospection_groupes_membres (groupe_id, employe_id) VALUES ($1,$2)',
          [req.params.id, employeId]
        );
      }
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'prospection', entityType: 'groupe_membres', entityId: req.params.id, details: { employe_ids }, ip: req.ip });
    res.json({ groupe_id: req.params.id, employe_ids });
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { DEPART_ITEMS } from './checklists.constants.js';

const router = Router();
router.use(requireStaff);

router.get(
  '/',
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    if (!req.query.employe_id) throw badRequest('employe_id requis');
    const params = [req.query.employe_id];
    const where = [`employe_id = $1`];
    if (req.query.type) {
      params.push(req.query.type);
      where.push(`type = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT ci.*, u.full_name AS checked_by_nom
         FROM rh_checklist_items ci
         LEFT JOIN users u ON u.id = ci.checked_by
        WHERE ${where.join(' AND ')}
        ORDER BY ci.type ASC, ci.ordre ASC`,
      params
    );
    res.json(rows);
  })
);

router.patch(
  '/items/:id',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const checked = Boolean(req.body?.checked);
    const { rows } = await query(
      `UPDATE rh_checklist_items SET
         checked = $2,
         checked_at = CASE WHEN $2 THEN now() ELSE NULL END,
         checked_by = CASE WHEN $2 THEN $3::uuid ELSE NULL END
       WHERE id = $1 RETURNING *`,
      [req.params.id, checked, req.user.id]
    );
    if (!rows[0]) throw notFound('Étape introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'checklist_item', entityId: rows[0].id, details: { checked }, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:employeId/depart',
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const { rows: employeRows } = await query('SELECT id FROM rh_employes WHERE id = $1', [req.params.employeId]);
    if (!employeRows[0]) throw notFound('Employé introuvable');

    const { rows: existing } = await query(
      `SELECT * FROM rh_checklist_items WHERE employe_id = $1 AND type = 'depart' ORDER BY ordre ASC`,
      [req.params.employeId]
    );
    if (existing.length > 0) {
      res.json(existing);
      return;
    }

    const inserted = [];
    for (let i = 0; i < DEPART_ITEMS.length; i++) {
      const { rows } = await query(
        `INSERT INTO rh_checklist_items (employe_id, type, item_key, label, ordre) VALUES ($1,'depart',$2,$3,$4) RETURNING *`,
        [req.params.employeId, DEPART_ITEMS[i].item_key, DEPART_ITEMS[i].label, i]
      );
      inserted.push(rows[0]);
    }
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'checklist_depart', entityId: req.params.employeId, ip: req.ip });
    res.status(201).json(inserted);
  })
);

export default router;

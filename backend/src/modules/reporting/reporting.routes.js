import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAdmin } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();
router.use(authenticate);

// KPI du tableau de bord global (lecture du module reporting)
router.get(
  '/kpi',
  requirePermission('reporting', 'read'),
  asyncHandler(async (_req, res) => {
    const [{ rows: users }, { rows: pending }, { rows: decided }, { rows: activity }] = await Promise.all([
      query("SELECT count(*)::int AS n FROM users WHERE is_active = true"),
      query("SELECT count(*)::int AS n FROM validations WHERE status = 'submitted'"),
      query("SELECT count(*)::int AS n FROM validations WHERE status IN ('validated','rejected')"),
      query("SELECT count(*)::int AS n FROM audit_log WHERE created_at > now() - interval '7 days'"),
    ]);
    res.json({
      utilisateurs_actifs: users[0].n,
      validations_en_attente: pending[0].n,
      validations_traitees: decided[0].n,
      actions_7j: activity[0].n,
    });
  })
);

// Journal d'audit (admin) — traçabilité des actions
router.get(
  '/audit',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { rows } = await query(
      `SELECT a.id, a.action, a.module_code, a.entity_type, a.entity_id,
              a.created_at, u.full_name AS user_name
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC
        LIMIT $1`,
      [limit]
    );
    res.json(rows);
  })
);

export default router;

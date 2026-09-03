import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { hashPassword } from '../../lib/password.js';

const router = Router();
router.use(authenticate, requireAdmin);

const createSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  password: z.string().min(8),
  role_code: z.string().trim().min(1),
  employe_id: z.string().uuid().optional().nullable(),
});

const roleChangeSchema = z.object({
  role_code: z.string().trim().min(1),
});

// Liste
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name, u.is_active, u.last_login_at,
              u.created_at, r.code AS role, r.name AS role_name
         FROM users u JOIN roles r ON r.id = u.role_id
        ORDER BY u.created_at DESC`
    );
    res.json(rows);
  })
);

// Création
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (email, nom, mot de passe ≥ 8, rôle)');
    const { email, full_name, password, role_code, employe_id } = parsed.data;

    const { rows: roleRows } = await query('SELECT id FROM roles WHERE code = $1', [role_code]);
    if (!roleRows[0]) throw badRequest('Rôle inconnu');

    if (employe_id) {
      const { rows: empRows } = await query('SELECT id, user_id FROM rh_employes WHERE id = $1', [employe_id]);
      if (!empRows[0]) throw badRequest('Employé introuvable');
      if (empRows[0].user_id) throw conflict('Cet employé est déjà lié à un compte');
    }

    const hash = await hashPassword(password);
    const user = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role_id)
         VALUES ($1,$2,$3,$4)
         RETURNING id, email, full_name, is_active, created_at`,
        [email, hash, full_name, roleRows[0].id]
      );
      if (employe_id) {
        await client.query('UPDATE rh_employes SET user_id = $2, updated_at = now() WHERE id = $1', [employe_id, rows[0].id]);
      }
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', entityType: 'user', entityId: user.id, ip: req.ip });
    res.status(201).json(user);
  })
);

// Changer le rôle d'un utilisateur existant
router.patch(
  '/:id/role',
  asyncHandler(async (req, res) => {
    const parsed = roleChangeSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Rôle requis');
    const { rows: roleRows } = await query('SELECT id FROM roles WHERE code = $1', [parsed.data.role_code]);
    if (!roleRows[0]) throw badRequest('Rôle inconnu');

    const { rows } = await query(
      `UPDATE users SET role_id = $2, updated_at = now() WHERE id = $1
       RETURNING id, email, full_name`,
      [req.params.id, roleRows[0].id]
    );
    if (!rows[0]) throw notFound('Utilisateur introuvable');
    await logAudit({ userId: req.user.id, action: 'update', entityType: 'user', entityId: req.params.id, details: { role_code: parsed.data.role_code }, ip: req.ip });
    res.json(rows[0]);
  })
);

// Activer / désactiver
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const active = Boolean(req.body?.is_active);
    const { rows } = await query(
      `UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1
       RETURNING id, email, is_active`,
      [req.params.id, active]
    );
    if (!rows[0]) throw notFound('Utilisateur introuvable');
    await logAudit({ userId: req.user.id, action: 'update', entityType: 'user', entityId: req.params.id, details: { is_active: active }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { MODULE_CODES } from '../business/registry.js';

const router = Router();
router.use(authenticate, requireAdmin);

const codeSchema = z.string().trim().regex(/^[a-z][a-z0-9_]*$/, 'Code invalide (minuscules, chiffres, underscore, doit commencer par une lettre)');

const createRoleSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(2),
  description: z.string().trim().optional().nullable(),
  is_staff: z.boolean().optional(),
  clone_from_role_id: z.string().uuid().optional().nullable(),
});

const updateRoleSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional().nullable(),
  is_staff: z.boolean().optional(),
});

// Rôles + matrice de permissions par module + nombre d'utilisateurs par rôle
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows: roles } = await query(
      `SELECT r.id, r.code, r.name, r.description, r.is_system, r.is_staff,
              count(u.id)::int AS user_count
         FROM roles r
         LEFT JOIN users u ON u.role_id = r.id
        GROUP BY r.id
        ORDER BY r.code`
    );
    const { rows: perms } = await query('SELECT * FROM role_module_permissions');
    const byRole = {};
    for (const p of perms) {
      (byRole[p.role_id] ||= []).push(p);
    }
    res.json(roles.map((r) => ({ ...r, permissions: byRole[r.id] || [] })));
  })
);

// Nouveau rôle personnalisé
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createRoleSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (code en minuscules, nom requis)');
    const r = parsed.data;

    const { rows: existing } = await query('SELECT id FROM roles WHERE code = $1', [r.code]);
    if (existing[0]) throw conflict('Ce code de rôle existe déjà');

    let clonePerms = null;
    if (r.clone_from_role_id) {
      const { rows } = await query('SELECT * FROM role_module_permissions WHERE role_id = $1', [r.clone_from_role_id]);
      if (rows.length === 0) throw badRequest('Rôle à cloner introuvable');
      clonePerms = Object.fromEntries(rows.map((p) => [p.module_code, p]));
    }

    const role = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO roles (code, name, description, is_system, is_staff)
         VALUES ($1,$2,$3,false,$4) RETURNING *`,
        [r.code, r.name, r.description || null, r.is_staff ?? false]
      );
      for (const moduleCode of MODULE_CODES) {
        const source = clonePerms?.[moduleCode];
        await client.query(
          `INSERT INTO role_module_permissions (role_id, module_code, can_read, can_create, can_update, can_delete, can_validate)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            rows[0].id,
            moduleCode,
            !!source?.can_read,
            !!source?.can_create,
            !!source?.can_update,
            !!source?.can_delete,
            !!source?.can_validate,
          ]
        );
      }
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', entityType: 'role', entityId: role.id, ip: req.ip });
    res.status(201).json(role);
  })
);

// Modification d'un rôle (nom / description / is_staff — pas le code, immuable)
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const r = parsed.data;

    const { rows: roleRows } = await query('SELECT * FROM roles WHERE id = $1', [req.params.id]);
    if (!roleRows[0]) throw notFound('Rôle introuvable');
    if (roleRows[0].is_system && r.is_staff !== undefined && r.is_staff !== roleRows[0].is_staff) {
      throw badRequest('Le statut « personnel » des rôles système ne peut pas être modifié');
    }

    const { rows } = await query(
      `UPDATE roles SET name = COALESCE($2, name), description = COALESCE($3, description), is_staff = COALESCE($4, is_staff)
       WHERE id = $1 RETURNING *`,
      [req.params.id, r.name, r.description, r.is_staff]
    );
    await logAudit({ userId: req.user.id, action: 'update', entityType: 'role', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

// Suppression d'un rôle personnalisé (jamais un rôle système, jamais s'il a des utilisateurs)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows: roleRows } = await query(
      `SELECT r.*, count(u.id)::int AS user_count FROM roles r LEFT JOIN users u ON u.role_id = r.id WHERE r.id = $1 GROUP BY r.id`,
      [req.params.id]
    );
    if (!roleRows[0]) throw notFound('Rôle introuvable');
    if (roleRows[0].is_system) throw badRequest('Les rôles système ne peuvent pas être supprimés');
    if (roleRows[0].user_count > 0) {
      throw badRequest(`Réaffectez d'abord le(s) ${roleRows[0].user_count} utilisateur(s) de ce rôle avant de le supprimer`);
    }
    await query('DELETE FROM roles WHERE id = $1', [req.params.id]);
    await logAudit({ userId: req.user.id, action: 'delete', entityType: 'role', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

// Mise à jour d'une cellule de permission (role, module)
router.put(
  '/:roleId/permissions/:moduleCode',
  asyncHandler(async (req, res) => {
    const { roleId, moduleCode } = req.params;
    const { rows: roleRows } = await query('SELECT code FROM roles WHERE id = $1', [roleId]);
    if (!roleRows[0]) throw notFound('Rôle introuvable');
    if (roleRows[0].code === 'admin') throw badRequest("Les droits de l'administrateur ne peuvent pas être modifiés");

    const b = req.body || {};
    const { rows } = await query(
      `UPDATE role_module_permissions
          SET can_read = $3, can_create = $4, can_update = $5, can_delete = $6, can_validate = $7
        WHERE role_id = $1 AND module_code = $2
        RETURNING *`,
      [roleId, moduleCode, !!b.can_read, !!b.can_create, !!b.can_update, !!b.can_delete, !!b.can_validate]
    );
    if (!rows[0]) throw notFound('Permission introuvable');
    await logAudit({ userId: req.user.id, action: 'update', entityType: 'permission', entityId: `${roleId}:${moduleCode}`, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

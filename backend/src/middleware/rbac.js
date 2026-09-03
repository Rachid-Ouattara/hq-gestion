import { query } from '../db/pool.js';
import { forbidden } from '../lib/http.js';

const ACTION_COLUMN = {
  read: 'can_read',
  create: 'can_create',
  update: 'can_update',
  delete: 'can_delete',
  validate: 'can_validate',
};

/** Charge la matrice de permissions du rôle de l'utilisateur (par module). */
export async function loadPermissions(roleId) {
  const { rows } = await query(
    `SELECT module_code, can_read, can_create, can_update, can_delete, can_validate
       FROM role_module_permissions WHERE role_id = $1`,
    [roleId]
  );
  const map = {};
  for (const r of rows) {
    map[r.module_code] = {
      read: r.can_read,
      create: r.can_create,
      update: r.can_update,
      delete: r.can_delete,
      validate: r.can_validate,
    };
  }
  return map;
}

/**
 * Garde d'accès : requirePermission('achats', 'create').
 * À utiliser après le middleware `authenticate`.
 */
export function requirePermission(moduleCode, action) {
  const column = ACTION_COLUMN[action];
  return async (req, _res, next) => {
    try {
      if (!column) return next(forbidden('Action inconnue'));
      const { rows } = await query(
        `SELECT ${column} AS allowed
           FROM role_module_permissions
          WHERE role_id = $1 AND module_code = $2`,
        [req.user.role_id, moduleCode]
      );
      if (!rows[0]?.allowed) {
        return next(forbidden(`Droit manquant : ${action} sur ${moduleCode}`));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Comme requirePermission mais le module est lu depuis req.params[param].
 * Utile pour les routes génériques /modules/:code/...
 */
export function requireModuleParamPermission(action, param = 'code') {
  const column = ACTION_COLUMN[action];
  return async (req, _res, next) => {
    try {
      if (!column) return next(forbidden('Action inconnue'));
      const moduleCode = req.params[param];
      const { rows } = await query(
        `SELECT ${column} AS allowed
           FROM role_module_permissions
          WHERE role_id = $1 AND module_code = $2`,
        [req.user.role_id, moduleCode]
      );
      if (!rows[0]?.allowed) {
        return next(forbidden(`Droit manquant : ${action} sur ${moduleCode}`));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Réserve une route au rôle admin (gestion utilisateurs/rôles). */
export function requireAdmin(req, _res, next) {
  if (req.user?.role_code !== 'admin') return next(forbidden('Réservé à l’administrateur'));
  next();
}

/**
 * Réserve une route au personnel (rôles marqués `is_staff` en base — admin,
 * secrétaire, direction, et tout rôle personnalisé créé comme tel), à
 * l'exclusion des rôles self-service restreints (ex. formateur, employé).
 * À utiliser en plus de `requirePermission` sur les ressources qu'un rôle
 * restreint ne doit jamais atteindre, même s'il a un droit de lecture/écriture
 * large sur le module. `is_staff` est chargé par `authenticate` (voir
 * `middleware/auth.js`), donc disponible sans requête supplémentaire ici.
 */
export function requireStaff(req, _res, next) {
  if (!req.user?.is_staff) {
    return next(forbidden('Réservé au personnel'));
  }
  next();
}

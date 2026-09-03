import { query } from '../db/pool.js';

/**
 * Écrit une entrée dans le journal d'audit.
 * Appelé explicitement depuis les services pour les actions sensibles.
 */
export async function logAudit({ userId, action, moduleCode, entityType, entityId, details, ip }) {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, module_code, entity_type, entity_id, details, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        userId || null,
        action,
        moduleCode || null,
        entityType || null,
        entityId != null ? String(entityId) : null,
        details ? JSON.stringify(details) : null,
        ip || null,
      ]
    );
  } catch (err) {
    // L'audit ne doit jamais casser la requête métier.
    // eslint-disable-next-line no-console
    console.error('[audit] échec écriture :', err.message);
  }
}

/**
 * Middleware qui journalise automatiquement les mutations réussies (2xx).
 * Utilisation : router.post('/', auditAction('achats','create','demande'), handler)
 */
export function auditAction(moduleCode, action, entityType) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAudit({
          userId: req.user?.id,
          action,
          moduleCode,
          entityType,
          entityId: res.locals.entityId,
          ip: req.ip,
        });
      }
    });
    next();
  };
}

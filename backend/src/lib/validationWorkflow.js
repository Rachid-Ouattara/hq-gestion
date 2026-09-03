import { query } from '../db/pool.js';
import { badRequest, notFound } from './http.js';
import { MODULE_CODES } from '../modules/business/registry.js';

/**
 * Moteur de validation générique et découplé.
 * N'importe quelle entité métier (bon de commande, dépense, devis...) peut être
 * soumise à validation par la Direction sans coupler sa table au workflow.
 */

export async function submitForValidation({ moduleCode, entityType, entityId, userId }) {
  if (!MODULE_CODES.includes(moduleCode)) throw badRequest('Module inconnu');
  const { rows } = await query(
    `INSERT INTO validations (module_code, entity_type, entity_id, status, requested_by)
     VALUES ($1,$2,$3,'submitted',$4)
     RETURNING *`,
    [moduleCode, entityType, String(entityId), userId]
  );
  return rows[0];
}

export async function decideValidation({ validationId, decision, userId, comment }) {
  if (!['validated', 'rejected'].includes(decision)) {
    throw badRequest("La décision doit être 'validated' ou 'rejected'");
  }
  const { rows } = await query(
    `UPDATE validations
        SET status = $2, decided_by = $3, decided_at = now(), comment = $4
      WHERE id = $1 AND status = 'submitted'
      RETURNING *`,
    [validationId, decision, userId, comment || null]
  );
  if (rows.length === 0) throw notFound('Demande de validation introuvable ou déjà traitée');
  return rows[0];
}

export async function listPending({ moduleCode } = {}) {
  const params = [];
  let where = "WHERE v.status = 'submitted'";
  if (moduleCode) {
    params.push(moduleCode);
    where += ` AND v.module_code = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT v.*, u.full_name AS requested_by_name
       FROM validations v
       LEFT JOIN users u ON u.id = v.requested_by
       ${where}
       ORDER BY v.requested_at ASC`,
    params
  );
  return rows;
}

export async function getEntityStatus({ moduleCode, entityType, entityId }) {
  const { rows } = await query(
    `SELECT * FROM validations
      WHERE module_code = $1 AND entity_type = $2 AND entity_id = $3
      ORDER BY requested_at DESC LIMIT 1`,
    [moduleCode, entityType, String(entityId)]
  );
  return rows[0] || null;
}

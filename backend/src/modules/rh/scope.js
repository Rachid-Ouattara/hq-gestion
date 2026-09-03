import { forbidden } from '../../lib/http.js';
import { query } from '../../db/pool.js';

/**
 * Résout si l'appelant agit en tant qu'employé restreint (formateur ou employé) à ses
 * propres données (et celles de ses subordonnés directs), ou en tant que staff (accès
 * complet). Retourne `null` pour le staff, `{ employeId, subordinateIds }` sinon.
 * Lève `forbidden` si le compte n'est lié à aucune fiche RH.
 */
export async function resolveActingEmploye(req) {
  if (!['formateur', 'employe'].includes(req.user.role_code)) return null;
  const { rows } = await query('SELECT id FROM rh_employes WHERE user_id = $1', [req.user.id]);
  if (!rows[0]) throw forbidden('Compte non lié à une fiche employé');
  const employeId = rows[0].id;
  const { rows: subRows } = await query('SELECT id FROM rh_employes WHERE responsable_id = $1', [employeId]);
  return { employeId, subordinateIds: subRows.map((r) => r.id) };
}

/**
 * Résout la fiche employé liée au compte appelant, quel que soit son rôle —
 * le pointage s'applique à tout employé physiquement au bureau, pas seulement
 * aux rôles self-service restreints. Retourne `null` (pas d'erreur) si aucune
 * fiche n'est liée, pour laisser l'appelant décider de la réponse adaptée.
 */
export async function resolveSelfEmploye(req) {
  const { rows } = await query('SELECT id FROM rh_employes WHERE user_id = $1', [req.user.id]);
  return rows[0]?.id || null;
}

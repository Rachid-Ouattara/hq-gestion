import { forbidden } from '../../lib/http.js';
import { query } from '../../db/pool.js';

/**
 * Résout si l'appelant agit en tant que formateur restreint à ses propres
 * données, ou en tant que staff (accès complet aux données du module).
 * Retourne `null` pour le staff, `{ employeId }` pour un formateur.
 * Lève `forbidden` si un compte "formateur" n'est lié à aucune fiche RH.
 */
export async function resolveActingFormateur(req) {
  if (req.user.role_code !== 'formateur') return null;
  const { rows } = await query('SELECT id FROM rh_employes WHERE user_id = $1', [req.user.id]);
  if (!rows[0]) throw forbidden('Compte formateur non lié à une fiche employé');
  return { employeId: rows[0].id };
}

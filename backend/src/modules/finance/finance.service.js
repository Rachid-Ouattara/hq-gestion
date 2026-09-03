import { badRequest, notFound } from '../../lib/http.js';

/**
 * Ajuste le solde d'un compte Finance et retourne le nouveau solde.
 * Exige un client de transaction existant (ne retombe jamais sur le pool
 * global) afin de composer dans la transaction de l'appelant (recette,
 * dépense, ou encaissement Commercial lié à un compte).
 */
export async function adjustCompteSolde(client, { compteId, delta }) {
  const { rows } = await client.query('SELECT * FROM finance_comptes WHERE id = $1 FOR UPDATE', [compteId]);
  if (!rows[0]) throw notFound('Compte introuvable');
  if (!rows[0].is_active) throw badRequest('Ce compte est inactif');

  const next = Number(rows[0].solde) + Number(delta);
  await client.query('UPDATE finance_comptes SET solde = $2, updated_at = now() WHERE id = $1', [compteId, next]);
  return next;
}

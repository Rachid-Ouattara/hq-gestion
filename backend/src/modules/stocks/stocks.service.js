import { badRequest, notFound } from '../../lib/http.js';
import { notifyRole } from '../../lib/notifications.js';

/**
 * Enregistre un mouvement de stock et met à jour le solde de l'article.
 * Exige un client de transaction existant (ne retombe jamais sur le pool global)
 * afin de composer dans la transaction de l'appelant (mouvement manuel,
 * clôture d'inventaire, ou réception d'achat).
 */
export async function registerMovement(client, { articleId, type, quantite, motif, sourceType = null, sourceId = null, userId, observations = null }) {
  const { rows: articleRows } = await client.query('SELECT * FROM stocks_articles WHERE id = $1 FOR UPDATE', [articleId]);
  if (!articleRows[0]) throw notFound('Article de stock introuvable');
  const article = articleRows[0];

  const delta = type === 'entree' ? Number(quantite) : -Number(quantite);
  const next = Number(article.quantite_stock) + delta;
  if (next < 0) throw badRequest(`Stock insuffisant pour « ${article.designation} » (disponible : ${article.quantite_stock})`);

  const { rows } = await client.query(
    `INSERT INTO stocks_mouvements (article_id, type, quantite, quantite_apres, motif, source_type, source_id, effectue_par, observations)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [articleId, type, quantite, next, motif, sourceType, sourceId, userId, observations]
  );

  await client.query('UPDATE stocks_articles SET quantite_stock = $2, updated_at = now() WHERE id = $1', [articleId, next]);

  const previous = Number(article.quantite_stock);
  const seuil = Number(article.seuil_alerte);
  if (previous > seuil && next <= seuil) {
    await notifyRole(client, {
      roleCode: 'secretaire',
      titre: "Seuil d'alerte atteint",
      message: `« ${article.designation} » est passé sous le seuil d'alerte (${next} restant, seuil : ${seuil}).`,
      moduleCode: 'stocks',
      entityType: 'article',
      entityId: articleId,
      critique: true,
    });
  }

  return rows[0];
}

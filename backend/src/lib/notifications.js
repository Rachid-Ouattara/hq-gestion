const NOTIFY_CHANNEL = 'hq_notifications';

/** `pg_notify` n'est délivré aux auditeurs `LISTEN` qu'après COMMIT de la transaction
 * courante (et jamais si elle est annulée) — c'est ce qui rend le déclenchement du
 * temps réel/push/e-mail sûr vis-à-vis d'un rollback, sans changer la forme des
 * appelants existants. Voir `realtime/notificationDispatcher.js`. */
async function announce(client, rows) {
  for (const row of rows) {
    await client.query(`SELECT pg_notify($1, $2)`, [NOTIFY_CHANNEL, row.id]);
  }
}

/**
 * Envoie une notification in-app à tous les utilisateurs actifs d'un rôle.
 * Exige un client de transaction existant (ne retombe jamais sur le pool
 * global) afin de composer dans la transaction de l'appelant — même contrat
 * que `stocks.service.js#registerMovement`.
 */
export async function notifyRole(client, { roleCode, titre, message, moduleCode = null, entityType = null, entityId = null, critique = false }) {
  const { rows } = await client.query(
    `INSERT INTO notifications (user_id, titre, message, module_code, entity_type, entity_id, critique)
     SELECT u.id, $2, $3, $4, $5, $6, $7
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.code = $1 AND u.is_active = true
     RETURNING id`,
    [roleCode, titre, message, moduleCode, entityType, entityId, critique]
  );
  await announce(client, rows);
}

/**
 * Envoie une notification in-app à un seul utilisateur (même contrat transactionnel
 * que `notifyRole`). Utilisé quand le destinataire est déterminé individuellement
 * (ex. le responsable assigné d'un employé) plutôt que par rôle.
 */
export async function notifyUser(client, { userId, titre, message, moduleCode = null, entityType = null, entityId = null, critique = false }) {
  const { rows } = await client.query(
    `INSERT INTO notifications (user_id, titre, message, module_code, entity_type, entity_id, critique)
     SELECT u.id, $2, $3, $4, $5, $6, $7
       FROM users u
      WHERE u.id = $1 AND u.is_active = true
     RETURNING id`,
    [userId, titre, message, moduleCode, entityType, entityId, critique]
  );
  await announce(client, rows);
}

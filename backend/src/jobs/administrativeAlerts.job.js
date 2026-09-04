import cron from 'node-cron';
import { withTransaction } from '../db/pool.js';
import { notifyRole } from '../lib/notifications.js';

/** Document arrivant à échéance dans 30 jours — rappel unique (déclenchement
 * exact à J-30, pas de colonne de suivi nécessaire). */
async function alertDocumentsEcheanceProche(client) {
  const { rows } = await client.query(
    `SELECT id, numero, titre FROM administrative_documents
      WHERE statut = 'actif' AND date_expiration = CURRENT_DATE + INTERVAL '30 days'`
  );
  for (const d of rows) {
    await notifyRole(client, {
      roleCode: 'secretaire',
      titre: 'Document arrivant à échéance',
      message: `Le document « ${d.titre} » (${d.numero}) arrive à échéance dans 30 jours.`,
      moduleCode: 'administrative',
      entityType: 'document',
      entityId: d.id,
      critique: true,
    });
  }
}

/** Document dont la date d'expiration est dépassée — bascule automatiquement
 * le statut à `expire` et notifie. */
async function expirerDocuments(client) {
  const { rows } = await client.query(
    `UPDATE administrative_documents SET statut = 'expire', updated_at = now()
      WHERE statut = 'actif' AND date_expiration < CURRENT_DATE
      RETURNING id, numero, titre`
  );
  for (const d of rows) {
    await notifyRole(client, {
      roleCode: 'secretaire',
      titre: 'Document expiré',
      message: `Le document « ${d.titre} » (${d.numero}) a dépassé sa date d'expiration.`,
      moduleCode: 'administrative',
      entityType: 'document',
      entityId: d.id,
      critique: true,
    });
  }
}

async function runDailyChecks() {
  await withTransaction(alertDocumentsEcheanceProche);
  await withTransaction(expirerDocuments);
}

export function registerAdministrativeAlertsJob() {
  cron.schedule('45 7 * * *', () => {
    runDailyChecks().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[jobs] échec alertes administratives quotidiennes', err.message);
    });
  });
}

export { runDailyChecks };

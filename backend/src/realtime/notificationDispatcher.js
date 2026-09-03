import pg from 'pg';
import webpush from 'web-push';
import { config } from '../config/index.js';
import { query } from '../db/pool.js';
import { sendNotificationEmail } from '../lib/mailer.js';
import { resolveNotificationUrl } from '../lib/notificationRoutes.js';

const NOTIFY_CHANNEL = 'hq_notifications';

/** Connexions SSE ouvertes, par utilisateur — un utilisateur peut avoir plusieurs onglets. */
const sseClients = new Map();

export function registerSseClient(userId, res) {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);
}

export function unregisterSseClient(userId, res) {
  const set = sseClients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) sseClients.delete(userId);
}

function pushToSse(userId, notification) {
  const set = sseClients.get(userId);
  if (!set) return;
  const payload = `data: ${JSON.stringify(notification)}\n\n`;
  for (const res of set) res.write(payload);
}

async function pushToWebPush(userId, notification, url) {
  if (!config.vapid.publicKey || !config.vapid.privateKey) return;
  const { rows } = await query('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
  const payload = JSON.stringify({ titre: notification.titre, message: notification.message, url });

  await Promise.all(
    rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        } else {
          // eslint-disable-next-line no-console
          console.error('[push] échec envoi', err.message);
        }
      }
    })
  );
}

async function handleNotification(id) {
  const { rows } = await query(
    `SELECT n.*, u.email, u.full_name
       FROM notifications n JOIN users u ON u.id = n.user_id
      WHERE n.id = $1`,
    [id]
  );
  const notification = rows[0];
  if (!notification) return;

  const url = resolveNotificationUrl({
    moduleCode: notification.module_code,
    entityType: notification.entity_type,
    entityId: notification.entity_id,
  });

  pushToSse(notification.user_id, notification);
  await pushToWebPush(notification.user_id, notification, url);

  if (notification.critique) {
    await sendNotificationEmail({
      to: notification.email,
      fullName: notification.full_name,
      titre: notification.titre,
      message: notification.message,
      actionUrl: `${config.webOrigin}${url}`,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[mailer] échec envoi notification critique', err.message);
    });
  }
}

async function connect() {
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  await client.query(`LISTEN ${NOTIFY_CHANNEL}`);

  client.on('notification', (msg) => {
    handleNotification(msg.payload).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[realtime] échec traitement notification', err.message);
    });
  });

  client.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[realtime] connexion LISTEN perdue, reconnexion…', err.message);
    setTimeout(connect, 3000);
  });

  // eslint-disable-next-line no-console
  console.log('[realtime] écoute des notifications démarrée');
}

export function startListening() {
  if (config.vapid.publicKey && config.vapid.privateKey) {
    webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
  } else {
    // eslint-disable-next-line no-console
    console.warn('[push] clés VAPID absentes — les notifications push navigateur sont désactivées');
  }
  connect().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[realtime] échec démarrage écoute', err.message);
    setTimeout(connect, 3000);
  });
}

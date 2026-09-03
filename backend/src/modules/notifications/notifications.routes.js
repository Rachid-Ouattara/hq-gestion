import { Router } from 'express';
import { asyncHandler, badRequest, notFound, unauthorized } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';
import { verifyAccessToken } from '../../lib/jwt.js';
import { query } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { registerSseClient, unregisterSseClient } from '../../realtime/notificationDispatcher.js';

const router = Router();

/** `EventSource` ne permet pas d'en-tête `Authorization` — le token (courte durée,
 * 900 s) est donc passé en query string pour cette seule route et vérifié à la main. */
router.get(
  '/stream',
  asyncHandler(async (req, res) => {
    let payload;
    try {
      payload = verifyAccessToken(req.query.token || '');
    } catch {
      throw unauthorized('Token invalide ou expiré');
    }
    const userId = payload.sub;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(':ok\n\n');

    registerSseClient(userId, res);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unregisterSseClient(userId, res);
    });
  })
);

router.use(authenticate);

router.get(
  '/vapid-public-key',
  asyncHandler(async (_req, res) => {
    res.json({ publicKey: config.vapid.publicKey });
  })
);

router.post(
  '/push-subscription',
  asyncHandler(async (req, res) => {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) throw badRequest('Abonnement push invalide');
    const { rows } = await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth_key, user_agent)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth_key = $4, user_agent = $5
       RETURNING id`,
      [req.user.id, endpoint, keys.p256dh, keys.auth, req.headers['user-agent'] || null]
    );
    res.status(201).json({ id: rows[0].id });
  })
);

router.delete(
  '/push-subscription',
  asyncHandler(async (req, res) => {
    const { endpoint } = req.body || {};
    if (!endpoint) throw badRequest('Endpoint requis');
    await query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [req.user.id, endpoint]);
    res.status(204).send();
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const params = [req.user.id];
    const where = ['user_id = $1'];
    if (req.query.lu !== undefined) {
      params.push(req.query.lu === 'true');
      where.push(`lu = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT * FROM notifications WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.patch(
  '/:id/lire',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE notifications SET lu = true WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) throw notFound('Notification introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/lire-tout',
  asyncHandler(async (req, res) => {
    await query(`UPDATE notifications SET lu = true WHERE user_id = $1 AND lu = false`, [req.user.id]);
    res.status(204).send();
  })
);

export default router;

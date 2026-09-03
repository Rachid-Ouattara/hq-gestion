import { Router } from 'express';
import crypto from 'node:crypto';
import { asyncHandler, badRequest, unauthorized } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';
import { requireStaff, requirePermission } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { getAuthUrl, exchangeCode, isGoogleConfigured } from '../../lib/googleCalendar.js';

const router = Router();

/** Nonces OAuth en mémoire, à usage unique, expirant après 5 min — protège le
 * `/callback` (public par nécessité, Google redirige le navigateur sans en-tête
 * possible) contre une soumission forgée. */
const pendingStates = new Map();
const STATE_TTL_MS = 5 * 60 * 1000;

function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, entry] of pendingStates) {
    if (entry.expiresAt < now) pendingStates.delete(state);
  }
}

router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    cleanupExpiredStates();
    const { code, state } = req.query;
    const entry = state && pendingStates.get(state);
    if (!entry) throw unauthorized('Lien de connexion Google invalide ou expiré');
    pendingStates.delete(state);
    if (!code) throw badRequest('Code Google manquant');

    const { refreshToken, email } = await exchangeCode(code);
    if (!refreshToken) {
      throw badRequest("Google n'a pas renvoyé de jeton de rafraîchissement — révoquez l'accès existant dans votre compte Google puis réessayez.");
    }
    await query(
      `INSERT INTO google_calendar_connexion (id, compte_email, refresh_token, connected_by)
       VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET compte_email = $1, refresh_token = $2, connected_by = $3, connected_at = now()`,
      [email, refreshToken, entry.userId]
    );
    res.redirect(`${config.webOrigin}/modules/rh/recrutement?google=connecte`);
  })
);

router.use(authenticate);
router.use(requireStaff);

router.get(
  '/status',
  requirePermission('rh', 'read'),
  asyncHandler(async (_req, res) => {
    if (!isGoogleConfigured()) return res.json({ configure: false, connected: false });
    const { rows } = await query('SELECT compte_email FROM google_calendar_connexion WHERE id = 1');
    res.json({ configure: true, connected: Boolean(rows[0]), compte_email: rows[0]?.compte_email || null });
  })
);

router.get(
  '/connect-url',
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    if (!isGoogleConfigured()) throw badRequest("La connexion Google Calendar n'est pas configurée sur le serveur");
    cleanupExpiredStates();
    const state = crypto.randomBytes(24).toString('hex');
    pendingStates.set(state, { userId: req.user.id, expiresAt: Date.now() + STATE_TTL_MS });
    res.json({ url: getAuthUrl(state) });
  })
);

router.delete(
  '/disconnect',
  requirePermission('rh', 'update'),
  asyncHandler(async (_req, res) => {
    await query('DELETE FROM google_calendar_connexion WHERE id = 1');
    res.status(204).send();
  })
);

export default router;

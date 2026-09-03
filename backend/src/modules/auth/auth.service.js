import { query } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { badRequest, unauthorized } from '../../lib/http.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateResetToken,
} from '../../lib/jwt.js';
import { sendPasswordResetEmail } from '../../lib/mailer.js';
import { logAudit } from '../../middleware/audit.js';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 heure

async function issueRefreshToken(userId) {
  const { raw, hash } = generateRefreshToken();
  const expires = new Date(Date.now() + config.jwt.refreshTtlDays * 86400 * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
    [userId, hash, expires]
  );
  return raw;
}

export async function login({ email, password, ip }) {
  const { rows } = await query(
    `SELECT u.*, r.code AS role_code, r.is_staff
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE lower(u.email) = lower($1)`,
    [email]
  );
  const user = rows[0];
  if (!user || !user.is_active) throw unauthorized('Identifiants invalides');

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw unauthorized('Identifiants invalides');

  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  await logAudit({ userId: user.id, action: 'login', ip });

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  return { accessToken, refreshToken, user: publicUser(user) };
}

export async function refresh({ refreshToken }) {
  if (!refreshToken) throw unauthorized('Refresh token manquant');
  const hash = hashRefreshToken(refreshToken);

  const { rows } = await query(
    `SELECT rt.*, u.email, r.code AS role_code
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE rt.token_hash = $1`,
    [hash]
  );
  const token = rows[0];
  if (!token || token.revoked_at || new Date(token.expires_at) < new Date()) {
    throw unauthorized('Session expirée, reconnectez-vous');
  }

  // Rotation : on révoque l'ancien, on en émet un nouveau.
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [token.id]);
  const accessToken = signAccessToken({ id: token.user_id, email: token.email, role_code: token.role_code });
  const newRefresh = await issueRefreshToken(token.user_id);
  return { accessToken, refreshToken: newRefresh };
}

export async function logout({ refreshToken }) {
  if (!refreshToken) return;
  const hash = hashRefreshToken(refreshToken);
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [hash]);
}

export async function forgotPassword({ email }) {
  const { rows } = await query(
    `SELECT u.id, u.full_name FROM users u WHERE lower(u.email) = lower($1) AND u.is_active = true`,
    [email]
  );
  const user = rows[0];
  if (!user) return; // silencieux : ne révèle jamais si le compte existe

  await query(`UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [user.id]);

  const { raw, hash } = generateResetToken();
  const expires = new Date(Date.now() + RESET_TTL_MS);
  await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
    [user.id, hash, expires]
  );

  const resetUrl = `${config.webOrigin}/reinitialiser-mot-de-passe?token=${raw}`;
  await sendPasswordResetEmail({ to: email, fullName: user.full_name, resetUrl });
}

export async function resetPassword({ token, password }) {
  const hash = hashRefreshToken(token);
  const { rows } = await query(
    `SELECT * FROM password_resets WHERE token_hash = $1`,
    [hash]
  );
  const reset = rows[0];
  if (!reset || reset.used_at || new Date(reset.expires_at) < new Date()) {
    throw badRequest('Lien invalide ou expiré');
  }

  const passwordHash = await hashPassword(password);
  await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [passwordHash, reset.user_id]);
  await query('UPDATE password_resets SET used_at = now() WHERE id = $1', [reset.id]);
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [reset.user_id]);
  await logAudit({ userId: reset.user_id, action: 'reset_password' });
}

export function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role_code,
    is_staff: u.is_staff,
  };
}

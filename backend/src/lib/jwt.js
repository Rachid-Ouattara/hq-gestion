import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config/index.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role_code },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

/** Le refresh token est aléatoire (opaque) ; on stocke seulement son hash. */
export function generateRefreshToken() {
  const raw = crypto.randomBytes(48).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashRefreshToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Même construction opaque que le refresh token, pour les liens de réinitialisation de mot de passe. */
export function generateResetToken() {
  const raw = crypto.randomBytes(48).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

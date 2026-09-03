import { verifyAccessToken } from '../lib/jwt.js';
import { unauthorized } from '../lib/http.js';
import { query } from '../db/pool.js';

/** Vérifie le token d'accès et charge l'utilisateur + son rôle. */
export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw unauthorized('Token invalide ou expiré');
    }

    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name, u.is_active, r.code AS role_code, r.id AS role_id, r.is_staff
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1`,
      [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.is_active) throw unauthorized('Compte inactif');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

import { AppError } from '../lib/http.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  // Violation d'unicité PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({ error: 'conflict', message: 'Cette valeur existe déjà' });
  }
  // eslint-disable-next-line no-console
  console.error('[error]', err);
  return res.status(500).json({ error: 'server_error', message: 'Erreur interne du serveur' });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'not_found', message: 'Route introuvable' });
}

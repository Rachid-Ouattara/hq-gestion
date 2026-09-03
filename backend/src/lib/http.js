export class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || 'error';
  }
}

export const badRequest = (msg) => new AppError(400, msg, 'bad_request');
export const unauthorized = (msg = 'Non authentifié') => new AppError(401, msg, 'unauthorized');
export const forbidden = (msg = 'Accès refusé') => new AppError(403, msg, 'forbidden');
export const notFound = (msg = 'Introuvable') => new AppError(404, msg, 'not_found');
export const conflict = (msg) => new AppError(409, msg, 'conflict');

/** Enrobe un handler async pour router les erreurs vers le middleware d'erreur. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

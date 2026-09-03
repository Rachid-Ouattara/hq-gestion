import { mkdirSync, unlink as unlinkCb } from 'node:fs';
import { promisify } from 'node:util';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import multer from 'multer';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = join(__dirname, '..', '..', '..', 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

export const unlink = promisify(unlinkCb);

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
});

export const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
});

export const uploadPhoto = multer({
  storage: diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

const PUBLIC_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]);

/** Upload public non authentifié (candidature en ligne) — plafond et types de
 * fichiers volontairement plus stricts que `upload` (usage interne). */
export const uploadPublic = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => cb(null, PUBLIC_UPLOAD_MIME_TYPES.has(file.mimetype)),
});

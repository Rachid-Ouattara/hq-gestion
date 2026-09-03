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

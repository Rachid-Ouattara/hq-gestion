import { Router } from 'express';
import { join } from 'node:path';
import { z } from 'zod';
import { asyncHandler, badRequest, forbidden, notFound } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';
import { loadPermissions } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { upload, unlink, UPLOAD_DIR } from './storage.js';

const router = Router();
router.use(authenticate);

const refSchema = z.object({
  module_code: z.string().trim().min(1),
  entity_type: z.string().trim().min(1),
  entity_id: z.string().trim().min(1),
});

/**
 * Une pièce jointe est accessible si le rôle a le droit `action` sur `module_code`
 * (matrice RBAC standard) ET, pour les rôles self-service restreints sur un dossier
 * employé RH, si l'entité visée est bien la propre fiche de l'appelant — empêche un
 * formateur/employé de lister/déposer/supprimer les documents d'un autre employé
 * alors même que son rôle a un droit `rh` à gros grain. `is_staff` (chargé par
 * `authenticate`) fait sauter cette restriction pour le personnel.
 */
async function canAccessAttachment(req, { module_code, entity_type, entity_id }, action) {
  const perms = await loadPermissions(req.user.role_id);
  if (!perms[module_code]?.[action]) return false;
  if (req.user.is_staff) return true;
  if (module_code === 'rh' && entity_type === 'employe') {
    const { rows } = await query('SELECT id FROM rh_employes WHERE user_id = $1', [req.user.id]);
    return rows[0]?.id === entity_id;
  }
  return true;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = refSchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('module_code, entity_type et entity_id requis');
    const { module_code, entity_type, entity_id } = parsed.data;
    if (!(await canAccessAttachment(req, parsed.data, 'read'))) throw forbidden('Accès refusé');
    const { rows } = await query(
      `SELECT p.*, u.full_name AS uploaded_by_nom
         FROM pieces_jointes p
         LEFT JOIN users u ON u.id = p.uploaded_by
        WHERE p.module_code = $1 AND p.entity_type = $2 AND p.entity_id = $3
        ORDER BY p.created_at DESC`,
      [module_code, entity_type, entity_id]
    );
    res.json(rows);
  })
);

router.post(
  '/',
  upload.single('fichier'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Fichier requis');
    const parsed = refSchema.safeParse(req.body);
    if (!parsed.success) {
      await unlink(req.file.path).catch(() => {});
      throw badRequest('module_code, entity_type et entity_id requis');
    }
    const { module_code, entity_type, entity_id } = parsed.data;

    if (!(await canAccessAttachment(req, parsed.data, 'create'))) {
      await unlink(req.file.path).catch(() => {});
      throw forbidden('Accès refusé');
    }

    const { rows: moduleRows } = await query('SELECT code FROM modules WHERE code = $1', [module_code]);
    if (!moduleRows[0]) {
      await unlink(req.file.path).catch(() => {});
      throw badRequest('Module inconnu');
    }

    const { rows } = await query(
      `INSERT INTO pieces_jointes (module_code, entity_type, entity_id, nom_original, chemin_stockage, type_mime, taille_octets, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [module_code, entity_type, entity_id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: module_code, entityType: 'piece_jointe', entityId: rows[0].id, details: { entity_type, entity_id }, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM pieces_jointes WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Pièce jointe introuvable');
    const pj = rows[0];
    if (!(await canAccessAttachment(req, pj, 'read'))) throw forbidden('Accès refusé');
    res.set('Content-Type', pj.type_mime);
    res.download(join(UPLOAD_DIR, pj.chemin_stockage), pj.nom_original, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'not_found', message: 'Fichier introuvable sur le serveur' });
    });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows: existing } = await query('SELECT * FROM pieces_jointes WHERE id = $1', [req.params.id]);
    if (!existing[0]) throw notFound('Pièce jointe introuvable');
    if (!(await canAccessAttachment(req, existing[0], 'delete'))) throw forbidden('Accès refusé');
    const { rows } = await query('DELETE FROM pieces_jointes WHERE id = $1 RETURNING *', [req.params.id]);
    await unlink(join(UPLOAD_DIR, rows[0].chemin_stockage)).catch(() => {});
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: rows[0].module_code, entityType: 'piece_jointe', entityId: rows[0].id, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

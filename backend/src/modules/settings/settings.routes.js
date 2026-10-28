import { Router } from 'express';
import { asyncHandler, badRequest } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { parametresEntrepriseSchema } from './settings.schemas.js';

const router = Router();
router.use(authenticate, requireAdmin);

router.get(
  '/entreprise',
  asyncHandler(async (_req, res) => {
    const { rows } = await query('SELECT * FROM parametres_entreprise WHERE id = 1');
    res.json(rows[0]);
  })
);

router.patch(
  '/entreprise',
  asyncHandler(async (req, res) => {
    const parsed = parametresEntrepriseSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const p = parsed.data;
    const { rows } = await query(
      `UPDATE parametres_entreprise SET
         nom_legal = COALESCE($1, nom_legal), adresse = COALESCE($2, adresse),
         telephone = COALESCE($3, telephone), email = COALESCE($4, email),
         numero_fiscal = COALESCE($5, numero_fiscal), updated_at = now()
       WHERE id = 1 RETURNING *`,
      [p.nom_legal, p.adresse, p.telephone, p.email, p.numero_fiscal]
    );
    await logAudit({ userId: req.user.id, action: 'update', entityType: 'parametres_entreprise', entityId: 'entreprise', ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

import { Router } from 'express';
import { asyncHandler, badRequest, forbidden } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';
import { requireModuleParamPermission, loadPermissions } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { MODULES } from './registry.js';
import {
  submitForValidation,
  decideValidation,
  listPending,
} from '../../lib/validationWorkflow.js';

const router = Router();
router.use(authenticate);

const registryByCode = Object.fromEntries(MODULES.map((m) => [m.code, m]));

// Liste des modules accessibles à l'utilisateur (lecture)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const perms = await loadPermissions(req.user.role_id);
    const modules = MODULES
      .filter((m) => perms[m.code]?.read)
      .map((m) => ({ ...m, permissions: perms[m.code] }));
    res.json(modules);
  })
);

// Métadonnées d'un module (lecture)
router.get(
  '/:code',
  requireModuleParamPermission('read'),
  asyncHandler(async (req, res) => {
    const m = registryByCode[req.params.code];
    if (!m) throw badRequest('Module inconnu');
    res.json(m);
  })
);

// Squelette : soumettre une entité à validation (démontre le workflow)
// create requis (la Secrétaire soumet), la Direction décidera.
router.post(
  '/:code/submit',
  requireModuleParamPermission('create'),
  asyncHandler(async (req, res) => {
    const { entity_type, entity_id } = req.body || {};
    if (!entity_type || !entity_id) throw badRequest('entity_type et entity_id requis');
    const v = await submitForValidation({
      moduleCode: req.params.code,
      entityType: entity_type,
      entityId: entity_id,
      userId: req.user.id,
    });
    await logAudit({
      userId: req.user.id,
      action: 'submit',
      moduleCode: req.params.code,
      entityType: entity_type,
      entityId: entity_id,
      ip: req.ip,
    });
    res.status(201).json(v);
  })
);

// File d'attente de validation d'un module (droit validate = Direction)
router.get(
  '/:code/validations',
  requireModuleParamPermission('validate'),
  asyncHandler(async (req, res) => {
    const rows = await listPending({ moduleCode: req.params.code });
    res.json(rows);
  })
);

export default router;

// ---- Décision de validation (route séparée : /api/validations/:id/decide) ----
export const validationsRouter = Router();
validationsRouter.use(authenticate);

validationsRouter.post(
  '/:id/decide',
  asyncHandler(async (req, res) => {
    const { decision, comment } = req.body || {};
    // Retrouver le module de la demande pour vérifier le droit `validate`
    const { rows } = await query('SELECT module_code FROM validations WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw badRequest('Demande introuvable');
    const moduleCode = rows[0].module_code;

    const perms = await loadPermissions(req.user.role_id);
    if (!perms[moduleCode]?.validate) throw forbidden(`Droit manquant : validate sur ${moduleCode}`);

    const v = await decideValidation({
      validationId: req.params.id,
      decision,
      userId: req.user.id,
      comment,
    });
    await logAudit({
      userId: req.user.id,
      action: decision === 'validated' ? 'validate' : 'reject',
      moduleCode,
      entityType: v.entity_type,
      entityId: v.entity_id,
      ip: req.ip,
    });
    res.json(v);
  })
);

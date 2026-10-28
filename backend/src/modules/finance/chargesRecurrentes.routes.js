import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query } from '../../db/pool.js';
import { chargeRecurrenteSchema } from './finance.schemas.js';

const updateSchema = chargeRecurrenteSchema.partial().extend({ actif: z.boolean().optional() });

const router = Router();

router.get(
  '/',
  requirePermission('finance', 'read'),
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT * FROM finance_charges_recurrentes ORDER BY actif DESC, prochaine_echeance ASC`
    );
    res.json(rows);
  })
);

router.post(
  '/',
  requirePermission('finance', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = chargeRecurrenteSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (libellé, montant, périodicité et prochaine échéance requis)');
    const c = parsed.data;
    const { rows } = await query(
      `INSERT INTO finance_charges_recurrentes (libelle, montant, periodicite, prochaine_echeance, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [c.libelle, c.montant, c.periodicite, c.prochaine_echeance, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'finance', entityType: 'charge_recurrente', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  requirePermission('finance', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;

    const { rows } = await query(
      `UPDATE finance_charges_recurrentes SET
         libelle = COALESCE($2, libelle), montant = COALESCE($3, montant),
         periodicite = COALESCE($4, periodicite), prochaine_echeance = COALESCE($5, prochaine_echeance),
         actif = COALESCE($6, actif), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, c.libelle, c.montant, c.periodicite, c.prochaine_echeance, c.actif]
    );
    if (!rows[0]) throw notFound('Charge récurrente introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'finance', entityType: 'charge_recurrente', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requirePermission('finance', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(`DELETE FROM finance_charges_recurrentes WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows[0]) throw notFound('Charge récurrente introuvable');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'finance', entityType: 'charge_recurrente', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

export default router;

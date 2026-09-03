import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { notifyRole } from '../../lib/notifications.js';
import { courrierSchema } from './administrative.schemas.js';

const router = Router();
const STAFF_ROLES = ['admin', 'secretaire', 'direction'];

router.get(
  '/',
  requirePermission('administrative', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (!STAFF_ROLES.includes(req.user.role_code)) {
      params.push(req.user.id);
      where.push(`c.created_by = $${params.length}`);
    }
    if (req.query.sens) {
      params.push(req.query.sens);
      where.push(`c.sens = $${params.length}`);
    }
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`c.statut = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`(c.objet ILIKE $${params.length} OR c.correspondant ILIKE $${params.length})`);
    }
    const { rows } = await query(
      `SELECT c.*, a.libelle AS archive_libelle, u.full_name AS traite_par_nom
         FROM administrative_courrier c
         LEFT JOIN administrative_archives a ON a.id = c.archive_id
         LEFT JOIN users u ON u.id = c.traite_par
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY c.date_courrier DESC, c.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('administrative', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT c.*, a.libelle AS archive_libelle
         FROM administrative_courrier c LEFT JOIN administrative_archives a ON a.id = c.archive_id
        WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Courrier introuvable');
    if (!STAFF_ROLES.includes(req.user.role_code) && rows[0].created_by !== req.user.id) throw notFound('Courrier introuvable');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  requirePermission('administrative', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = courrierSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides (sens, objet et correspondant requis)');
    const c = parsed.data;
    const isSelfService = !STAFF_ROLES.includes(req.user.role_code);

    const courrier = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO administrative_courrier (sens, objet, correspondant, date_courrier, mode_transmission, traite_par, observations, created_by)
         VALUES ($1,$2,$3,COALESCE($4, CURRENT_DATE),$5,$6,$7,$6)
         RETURNING *`,
        [c.sens, c.objet, c.correspondant, c.date_courrier || null, c.mode_transmission || null, req.user.id, c.observations || null]
      );
      if (isSelfService) {
        await notifyRole(client, {
          roleCode: 'secretaire',
          titre: 'Nouveau courrier à traiter',
          message: `${req.user.full_name || 'Un employé'} a soumis un courrier : ${rows[0].objet}.`,
          moduleCode: 'administrative',
          entityType: 'courrier',
          entityId: rows[0].id,
        });
      }
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'administrative', entityType: 'courrier', entityId: courrier.id, ip: req.ip });
    res.status(201).json(courrier);
  })
);

router.patch(
  '/:id',
  requirePermission('administrative', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = courrierSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const c = parsed.data;
    const { rows } = await query(
      `UPDATE administrative_courrier SET
         objet = COALESCE($2, objet), correspondant = COALESCE($3, correspondant),
         date_courrier = COALESCE($4, date_courrier), mode_transmission = COALESCE($5, mode_transmission),
         observations = COALESCE($6, observations), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, c.objet, c.correspondant, c.date_courrier, c.mode_transmission, c.observations]
    );
    if (!rows[0]) throw notFound('Courrier introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'administrative', entityType: 'courrier', entityId: rows[0].id, ip: req.ip });
    res.json(rows[0]);
  })
);

router.post(
  '/:id/archiver',
  requirePermission('administrative', 'update'),
  asyncHandler(async (req, res) => {
    const archiveId = req.body?.archive_id;
    if (!archiveId) throw badRequest('archive_id requis');
    const { rows } = await query(
      `UPDATE administrative_courrier SET statut = 'archive', archive_id = $2, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, archiveId]
    );
    if (!rows[0]) throw notFound('Courrier introuvable');
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'administrative', entityType: 'courrier', entityId: rows[0].id, details: { statut: 'archive' }, ip: req.ip });
    res.json(rows[0]);
  })
);

export default router;

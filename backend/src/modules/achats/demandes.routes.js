import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { submitForValidation, decideValidation, getEntityStatus } from '../../lib/validationWorkflow.js';
import { notifyRole } from '../../lib/notifications.js';
import { demandeSchema, decisionSchema } from './achats.schemas.js';

const router = Router();
const ENTITY_TYPE = 'demande_achat';

router.get(
  '/',
  requirePermission('achats', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.statut) {
      params.push(req.query.statut);
      where.push(`d.statut = $${params.length}`);
    }
    if (req.query.demandeur_id) {
      params.push(req.query.demandeur_id);
      where.push(`d.demandeur_id = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`d.objet ILIKE $${params.length}`);
    }
    const { rows } = await query(
      `SELECT d.*, u.full_name AS demandeur_nom
         FROM demandes_achat d
         LEFT JOIN users u ON u.id = d.demandeur_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY d.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requirePermission('achats', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT d.*, u.full_name AS demandeur_nom
         FROM demandes_achat d
         LEFT JOIN users u ON u.id = d.demandeur_id
        WHERE d.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw notFound('Demande introuvable');
    const { rows: lignes } = await query(
      'SELECT * FROM demandes_achat_lignes WHERE demande_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    const validation = await getEntityStatus({ moduleCode: 'achats', entityType: ENTITY_TYPE, entityId: req.params.id });
    res.json({ ...rows[0], lignes, validation });
  })
);

router.post(
  '/',
  requirePermission('achats', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = demandeSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Champs invalides (objet et au moins une ligne requis)");
    const d = parsed.data;

    const demande = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO demandes_achat (objet, justification, demandeur_id, fournisseur_suggere_id)
         VALUES ($1,$2,$3,$4)
         RETURNING *`,
        [d.objet, d.justification || null, req.user.id, d.fournisseur_suggere_id || null]
      );
      const demandeId = rows[0].id;
      for (const l of d.lignes) {
        await client.query(
          `INSERT INTO demandes_achat_lignes (demande_id, designation, quantite, unite, prix_estime_unitaire)
           VALUES ($1,$2,$3,$4,$5)`,
          [demandeId, l.designation, l.quantite, l.unite || null, l.prix_estime_unitaire]
        );
      }
      const { rows: totalRows } = await client.query(
        `UPDATE demandes_achat SET montant_estime =
           (SELECT COALESCE(SUM(montant_estime), 0) FROM demandes_achat_lignes WHERE demande_id = $1)
         WHERE id = $1 RETURNING *`,
        [demandeId]
      );
      return totalRows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'achats', entityType: ENTITY_TYPE, entityId: demande.id, ip: req.ip });
    res.status(201).json(demande);
  })
);

router.patch(
  '/:id',
  requirePermission('achats', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = demandeSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Champs invalides (objet et au moins une ligne requis)");
    const d = parsed.data;

    const demande = await withTransaction(async (client) => {
      const { rows: current } = await client.query('SELECT statut FROM demandes_achat WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current[0]) throw notFound('Demande introuvable');
      if (current[0].statut !== 'brouillon') throw badRequest('Seule une demande en brouillon peut être modifiée');

      await client.query(
        `UPDATE demandes_achat SET objet=$2, justification=$3, fournisseur_suggere_id=$4, updated_at=now()
         WHERE id = $1`,
        [req.params.id, d.objet, d.justification || null, d.fournisseur_suggere_id || null]
      );
      await client.query('DELETE FROM demandes_achat_lignes WHERE demande_id = $1', [req.params.id]);
      for (const l of d.lignes) {
        await client.query(
          `INSERT INTO demandes_achat_lignes (demande_id, designation, quantite, unite, prix_estime_unitaire)
           VALUES ($1,$2,$3,$4,$5)`,
          [req.params.id, l.designation, l.quantite, l.unite || null, l.prix_estime_unitaire]
        );
      }
      const { rows } = await client.query(
        `UPDATE demandes_achat SET montant_estime =
           (SELECT COALESCE(SUM(montant_estime), 0) FROM demandes_achat_lignes WHERE demande_id = $1)
         WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      return rows[0];
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'achats', entityType: ENTITY_TYPE, entityId: demande.id, ip: req.ip });
    res.json(demande);
  })
);

router.delete(
  '/:id',
  requirePermission('achats', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `DELETE FROM demandes_achat WHERE id = $1 AND statut = 'brouillon' RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) throw badRequest('Seule une demande en brouillon peut être supprimée');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'achats', entityType: ENTITY_TYPE, entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

router.post(
  '/:id/soumettre',
  requirePermission('achats', 'create'),
  asyncHandler(async (req, res) => {
    const demande = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM demandes_achat WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!rows[0]) throw notFound('Demande introuvable');
      if (rows[0].statut !== 'brouillon') throw badRequest('Seule une demande en brouillon peut être soumise');

      await submitForValidation({ moduleCode: 'achats', entityType: ENTITY_TYPE, entityId: req.params.id, userId: req.user.id });
      const { rows: updated } = await client.query(
        `UPDATE demandes_achat SET statut = 'soumise', updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      await notifyRole(client, {
        roleCode: 'direction',
        titre: 'Demande d\'achat à valider',
        message: `Une demande d'achat a été soumise : ${updated[0].numero} — ${updated[0].objet}.`,
        moduleCode: 'achats',
        entityType: ENTITY_TYPE,
        entityId: req.params.id,
      });
      return updated[0];
    });

    await logAudit({ userId: req.user.id, action: 'submit', moduleCode: 'achats', entityType: ENTITY_TYPE, entityId: demande.id, ip: req.ip });
    res.json(demande);
  })
);

router.post(
  '/:id/decider',
  requirePermission('achats', 'validate'),
  asyncHandler(async (req, res) => {
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("La décision doit être 'validated' ou 'rejected'");
    const { decision, comment } = parsed.data;

    const pending = await getEntityStatus({ moduleCode: 'achats', entityType: ENTITY_TYPE, entityId: req.params.id });
    if (!pending || pending.status !== 'submitted') throw badRequest('Aucune demande de validation en attente pour cette demande');

    const demande = await withTransaction(async (client) => {
      await decideValidation({ validationId: pending.id, decision, userId: req.user.id, comment });
      const { rows } = await client.query(
        `UPDATE demandes_achat SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id, decision === 'validated' ? 'validee' : 'rejetee']
      );
      return rows[0];
    });

    await logAudit({
      userId: req.user.id,
      action: decision === 'validated' ? 'validate' : 'reject',
      moduleCode: 'achats',
      entityType: ENTITY_TYPE,
      entityId: demande.id,
      ip: req.ip,
    });
    res.json(demande);
  })
);

export default router;

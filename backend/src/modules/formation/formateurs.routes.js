import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { domainesSchema } from './formation.schemas.js';

const router = Router();
router.use(requireStaff);

router.get(
  '/',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = ['fd.employe_id IS NOT NULL'];
    if (req.query.domaine) {
      params.push(req.query.domaine);
      where.push(`d.domaine = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT e.id, e.matricule, e.nom, e.prenom, e.poste, e.statut,
              array_agg(d.domaine ORDER BY d.domaine) FILTER (WHERE d.domaine IS NOT NULL) AS domaines
         FROM rh_employes e
         JOIN formation_formateur_domaines fd ON fd.employe_id = e.id
         LEFT JOIN formation_formateur_domaines d ON d.employe_id = e.id
        WHERE ${where.join(' AND ')}
        GROUP BY e.id
        ORDER BY e.nom ASC, e.prenom ASC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:employeId',
  requirePermission('formation', 'read'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, matricule, nom, prenom, poste, statut FROM rh_employes WHERE id = $1`,
      [req.params.employeId]
    );
    if (!rows[0]) throw notFound('Employé introuvable');
    const { rows: domaines } = await query(
      'SELECT domaine FROM formation_formateur_domaines WHERE employe_id = $1 ORDER BY domaine ASC',
      [req.params.employeId]
    );
    res.json({ ...rows[0], domaines: domaines.map((d) => d.domaine) });
  })
);

router.put(
  '/:employeId/domaines',
  requirePermission('formation', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = domainesSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Liste de domaines invalide');
    const { domaines } = parsed.data;

    const { rows: empRows } = await query('SELECT id FROM rh_employes WHERE id = $1', [req.params.employeId]);
    if (!empRows[0]) throw notFound('Employé introuvable');

    await withTransaction(async (client) => {
      await client.query('DELETE FROM formation_formateur_domaines WHERE employe_id = $1', [req.params.employeId]);
      for (const domaine of domaines) {
        await client.query(
          'INSERT INTO formation_formateur_domaines (employe_id, domaine) VALUES ($1,$2)',
          [req.params.employeId, domaine]
        );
      }
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'formation', entityType: 'formateur_domaines', entityId: req.params.employeId, details: { domaines }, ip: req.ip });
    res.json({ employe_id: req.params.employeId, domaines });
  })
);

export default router;

import { Router } from 'express';
import ExcelJS from 'exceljs';
import { asyncHandler } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAdmin } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();
router.use(authenticate);

// KPI du tableau de bord global (lecture du module reporting)
router.get(
  '/kpi',
  requirePermission('reporting', 'read'),
  asyncHandler(async (_req, res) => {
    const [{ rows: users }, { rows: pending }, { rows: decided }, { rows: activity }] = await Promise.all([
      query("SELECT count(*)::int AS n FROM users WHERE is_active = true"),
      query("SELECT count(*)::int AS n FROM validations WHERE status = 'submitted'"),
      query("SELECT count(*)::int AS n FROM validations WHERE status IN ('validated','rejected')"),
      query("SELECT count(*)::int AS n FROM audit_log WHERE created_at > now() - interval '7 days'"),
    ]);
    res.json({
      utilisateurs_actifs: users[0].n,
      validations_en_attente: pending[0].n,
      validations_traitees: decided[0].n,
      actions_7j: activity[0].n,
    });
  })
);

const VALID_JOURS = [7, 30, 90];

/** Tendances agrégées par jour, sur une fenêtre glissante (7/30/90 jours) plutôt
 * que par mois calendaire — l'historique réel de l'application tient aujourd'hui
 * sur environ une semaine, une vue « 12 derniers mois » serait presque vide. */
router.get(
  '/tendances',
  requirePermission('reporting', 'read'),
  asyncHandler(async (req, res) => {
    const jours = VALID_JOURS.includes(Number(req.query.jours)) ? Number(req.query.jours) : 30;

    const [
      { rows: activiteParModule },
      { rows: recettes },
      { rows: depenses },
      { rows: devisCrees },
      { rows: devisAcceptes },
      { rows: facture },
      { rows: conges },
      { rows: candidats },
      { rows: achats },
    ] = await Promise.all([
      query(
        `SELECT date_trunc('day', created_at)::date AS jour, module_code, count(*)::int AS n
           FROM audit_log WHERE created_at >= now() - ($1 || ' days')::interval
          GROUP BY 1, 2 ORDER BY 1`,
        [jours]
      ),
      query(
        `SELECT date_trunc('day', date_recette)::date AS jour, COALESCE(SUM(montant),0)::float AS total
           FROM finance_recettes WHERE date_recette >= (CURRENT_DATE - ($1 || ' days')::interval)
          GROUP BY 1 ORDER BY 1`,
        [jours]
      ),
      query(
        `SELECT date_trunc('day', date_depense)::date AS jour, COALESCE(SUM(montant),0)::float AS total
           FROM finance_depenses WHERE date_depense >= (CURRENT_DATE - ($1 || ' days')::interval)
          GROUP BY 1 ORDER BY 1`,
        [jours]
      ),
      query(
        `SELECT date_trunc('day', date_devis)::date AS jour, count(*)::int AS n
           FROM commercial_devis WHERE date_devis >= (CURRENT_DATE - ($1 || ' days')::interval)
          GROUP BY 1 ORDER BY 1`,
        [jours]
      ),
      query(
        `SELECT date_trunc('day', date_devis)::date AS jour, count(*)::int AS n
           FROM commercial_devis WHERE statut = 'accepte' AND date_devis >= (CURRENT_DATE - ($1 || ' days')::interval)
          GROUP BY 1 ORDER BY 1`,
        [jours]
      ),
      query(
        `SELECT date_trunc('day', date_facture)::date AS jour, COALESCE(SUM(montant_total),0)::float AS total
           FROM commercial_factures
          WHERE statut != 'annulee' AND date_facture >= (CURRENT_DATE - ($1 || ' days')::interval)
          GROUP BY 1 ORDER BY 1`,
        [jours]
      ),
      query(
        `SELECT date_trunc('day', created_at)::date AS jour, count(*)::int AS n
           FROM rh_conges WHERE created_at >= now() - ($1 || ' days')::interval
          GROUP BY 1 ORDER BY 1`,
        [jours]
      ),
      query(
        `SELECT date_trunc('day', created_at)::date AS jour, count(*)::int AS n
           FROM rh_candidats WHERE created_at >= now() - ($1 || ' days')::interval
          GROUP BY 1 ORDER BY 1`,
        [jours]
      ),
      query(
        `SELECT date_trunc('day', date_commande)::date AS jour, COALESCE(SUM(montant_total),0)::float AS total
           FROM bons_de_commande
          WHERE statut != 'annule' AND date_commande >= (CURRENT_DATE - ($1 || ' days')::interval)
          GROUP BY 1 ORDER BY 1`,
        [jours]
      ),
    ]);

    res.json({
      jours,
      activite_par_module: activiteParModule,
      finances: { recettes, depenses },
      commercial: { devis_crees: devisCrees, devis_acceptes: devisAcceptes, chiffre_affaires_facture: facture },
      rh: { conges, candidats },
      achats: { montant_commande: achats },
    });
  })
);

function auditFilters(query_) {
  const params = [];
  const where = [];
  if (query_.module_code) {
    params.push(query_.module_code);
    where.push(`a.module_code = $${params.length}`);
  }
  if (query_.action) {
    params.push(query_.action);
    where.push(`a.action = $${params.length}`);
  }
  if (query_.user_id) {
    params.push(query_.user_id);
    where.push(`a.user_id = $${params.length}`);
  }
  if (query_.date_from) {
    params.push(query_.date_from);
    where.push(`a.created_at >= $${params.length}`);
  }
  if (query_.date_to) {
    params.push(query_.date_to);
    where.push(`a.created_at <= $${params.length}::date + interval '1 day'`);
  }
  return { params, where };
}

// Journal d'audit (admin) — traçabilité des actions
router.get(
  '/audit',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const { params, where } = auditFilters(req.query);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [{ rows }, { rows: countRows }] = await Promise.all([
      query(
        `SELECT a.id, a.action, a.module_code, a.entity_type, a.entity_id,
                a.created_at, u.full_name AS user_name
           FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
           ${whereSql}
          ORDER BY a.created_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      query(`SELECT count(*)::int AS n FROM audit_log a ${whereSql}`, params),
    ]);
    res.json({ rows, total: countRows[0].n });
  })
);

router.get(
  '/audit/export',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { params, where } = auditFilters(req.query);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT a.created_at, u.full_name AS user_name, a.action, a.module_code, a.entity_type, a.entity_id
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
         ${whereSql}
        ORDER BY a.created_at DESC
        LIMIT 5000`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Journal d\'audit');
    sheet.columns = [
      { header: 'Date', key: 'created_at', width: 22 },
      { header: 'Utilisateur', key: 'user_name', width: 24 },
      { header: 'Action', key: 'action', width: 14 },
      { header: 'Module', key: 'module_code', width: 16 },
      { header: 'Type', key: 'entity_type', width: 18 },
      { header: 'Référence', key: 'entity_id', width: 24 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) {
      sheet.addRow({
        created_at: new Date(r.created_at).toLocaleString('fr-FR'),
        user_name: r.user_name || '—',
        action: r.action,
        module_code: r.module_code || '—',
        entity_type: r.entity_type || '—',
        entity_id: r.entity_id || '—',
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="journal-audit-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  })
);

export default router;

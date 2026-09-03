import { Router } from 'express';
import { asyncHandler, badRequest, forbidden, notFound } from '../../lib/http.js';
import { requirePermission, requireStaff } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { query, withTransaction } from '../../db/pool.js';
import { isIpAllowed } from '../../lib/ipMatch.js';
import { notifyRole, notifyUser } from '../../lib/notifications.js';
import { resolveSelfEmploye } from './scope.js';
import { parametresPointageSchema, ipAutoriseeSchema, pointageManuelSchema } from './rh.schemas.js';

const router = Router();

async function checkOfficeIp(req) {
  const { rows } = await query('SELECT ip_ou_cidr FROM rh_ip_autorisees');
  if (rows.length === 0 || !isIpAllowed(req.ip, rows)) {
    throw forbidden('Pointage possible uniquement depuis le réseau du bureau');
  }
}

function computeStatut(now, parametres) {
  const [h, m] = parametres.heure_arrivee_attendue.split(':').map(Number);
  const limiteMinutes = h * 60 + m + parametres.tolerance_minutes;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes > limiteMinutes ? 'retard' : 'present';
}

// --- Paramètres ---

router.get(
  '/parametres',
  requireStaff,
  requirePermission('rh', 'read'),
  asyncHandler(async (_req, res) => {
    const { rows } = await query('SELECT * FROM rh_parametres_pointage WHERE id = 1');
    res.json(rows[0]);
  })
);

router.patch(
  '/parametres',
  requireStaff,
  requirePermission('rh', 'update'),
  asyncHandler(async (req, res) => {
    const parsed = parametresPointageSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Champs invalides');
    const p = parsed.data;
    const { rows } = await query(
      `UPDATE rh_parametres_pointage SET
         heure_arrivee_attendue = COALESCE($1, heure_arrivee_attendue),
         tolerance_minutes = COALESCE($2, tolerance_minutes)
       WHERE id = 1 RETURNING *`,
      [p.heure_arrivee_attendue, p.tolerance_minutes]
    );
    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'parametres_pointage', entityId: 'singleton', ip: req.ip });
    res.json(rows[0]);
  })
);

// --- IP autorisées ---

router.get(
  '/ip-autorisees',
  requireStaff,
  requirePermission('rh', 'read'),
  asyncHandler(async (_req, res) => {
    const { rows } = await query('SELECT * FROM rh_ip_autorisees ORDER BY created_at DESC');
    res.json(rows);
  })
);

router.post(
  '/ip-autorisees',
  requireStaff,
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = ipAutoriseeSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Libellé et adresse IP (ou CIDR) requis');
    const { rows } = await query(
      `INSERT INTO rh_ip_autorisees (label, ip_ou_cidr, created_by) VALUES ($1,$2,$3) RETURNING *`,
      [parsed.data.label, parsed.data.ip_ou_cidr, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'ip_autorisee', entityId: rows[0].id, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

router.delete(
  '/ip-autorisees/:id',
  requireStaff,
  requirePermission('rh', 'delete'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM rh_ip_autorisees WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw notFound('Entrée introuvable');
    await logAudit({ userId: req.user.id, action: 'delete', moduleCode: 'rh', entityType: 'ip_autorisee', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  })
);

// --- Pointage self-service (tout compte lié à une fiche RH, quel que soit le rôle) ---

router.get(
  '/mon-jour',
  asyncHandler(async (req, res) => {
    const employeId = await resolveSelfEmploye(req);
    if (!employeId) throw badRequest('Compte non lié à une fiche employé');
    const { rows } = await query(
      `SELECT * FROM rh_pointages WHERE employe_id = $1 AND date_jour = CURRENT_DATE`,
      [employeId]
    );
    res.json(rows[0] || null);
  })
);

router.post(
  '/pointer/arrivee',
  asyncHandler(async (req, res) => {
    const employeId = await resolveSelfEmploye(req);
    if (!employeId) throw badRequest('Compte non lié à une fiche employé');
    await checkOfficeIp(req);

    const { rows: paramRows } = await query('SELECT * FROM rh_parametres_pointage WHERE id = 1');
    const statut = computeStatut(new Date(), paramRows[0]);

    const pointage = await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO rh_pointages (employe_id, date_jour) VALUES ($1, CURRENT_DATE) ON CONFLICT (employe_id, date_jour) DO NOTHING`,
        [employeId]
      );
      const { rows } = await client.query(
        `SELECT * FROM rh_pointages WHERE employe_id = $1 AND date_jour = CURRENT_DATE FOR UPDATE`,
        [employeId]
      );
      if (rows[0].heure_arrivee) throw badRequest("Arrivée déjà pointée aujourd'hui");
      const { rows: updated } = await client.query(
        `UPDATE rh_pointages SET heure_arrivee = now(), ip_arrivee = $2, statut = $3, updated_at = now() WHERE id = $1 RETURNING *`,
        [rows[0].id, req.ip, statut]
      );

      if (statut === 'retard') {
        const { rows: empRows } = await client.query(
          `SELECT e.nom, e.prenom, r.user_id AS responsable_user_id
             FROM rh_employes e LEFT JOIN rh_employes r ON r.id = e.responsable_id
            WHERE e.id = $1`,
          [employeId]
        );
        const emp = empRows[0];
        const titre = 'Retard de pointage';
        const message = `${emp.prenom} ${emp.nom} a pointé son arrivée en retard aujourd'hui.`;
        if (emp.responsable_user_id) {
          await notifyUser(client, { userId: emp.responsable_user_id, titre, message, moduleCode: 'rh', entityType: 'pointage', entityId: updated[0].id });
        } else {
          await notifyRole(client, { roleCode: 'direction', titre, message, moduleCode: 'rh', entityType: 'pointage', entityId: updated[0].id });
        }
      }

      return updated[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'pointage', entityId: pointage.id, details: { type: 'arrivee' }, ip: req.ip });
    res.status(201).json(pointage);
  })
);

router.post(
  '/pointer/depart',
  asyncHandler(async (req, res) => {
    const employeId = await resolveSelfEmploye(req);
    if (!employeId) throw badRequest('Compte non lié à une fiche employé');
    await checkOfficeIp(req);

    const pointage = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM rh_pointages WHERE employe_id = $1 AND date_jour = CURRENT_DATE FOR UPDATE`,
        [employeId]
      );
      if (!rows[0] || !rows[0].heure_arrivee) throw badRequest("Aucune arrivée pointée aujourd'hui");
      if (rows[0].heure_depart) throw badRequest("Départ déjà pointé aujourd'hui");
      const { rows: updated } = await client.query(
        `UPDATE rh_pointages SET heure_depart = now(), ip_depart = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [rows[0].id, req.ip]
      );
      return updated[0];
    });

    await logAudit({ userId: req.user.id, action: 'update', moduleCode: 'rh', entityType: 'pointage', entityId: pointage.id, details: { type: 'depart' }, ip: req.ip });
    res.json(pointage);
  })
);

// --- Vue staff ---

router.get(
  '/',
  requireStaff,
  requirePermission('rh', 'read'),
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.date) {
      params.push(req.query.date);
      where.push(`p.date_jour = $${params.length}`);
    } else {
      where.push(`p.date_jour = CURRENT_DATE`);
    }
    if (req.query.employe_id) {
      params.push(req.query.employe_id);
      where.push(`p.employe_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT p.*, e.nom, e.prenom
         FROM rh_pointages p JOIN rh_employes e ON e.id = p.employe_id
        WHERE ${where.join(' AND ')}
        ORDER BY e.nom ASC, e.prenom ASC`,
      params
    );
    res.json(rows);
  })
);

router.post(
  '/manuel',
  requireStaff,
  requirePermission('rh', 'create'),
  asyncHandler(async (req, res) => {
    const parsed = pointageManuelSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Employé et date requis');
    const m = parsed.data;
    const { rows: empRows } = await query('SELECT id FROM rh_employes WHERE id = $1', [m.employe_id]);
    if (!empRows[0]) throw badRequest('Employé introuvable');

    const { rows } = await query(
      `INSERT INTO rh_pointages (employe_id, date_jour, heure_arrivee, heure_depart, source, notes, created_by)
       VALUES ($1,$2,$3,$4,'manuel',$5,$6)
       ON CONFLICT (employe_id, date_jour) DO UPDATE SET
         heure_arrivee = COALESCE(EXCLUDED.heure_arrivee, rh_pointages.heure_arrivee),
         heure_depart = COALESCE(EXCLUDED.heure_depart, rh_pointages.heure_depart),
         source = 'manuel', notes = COALESCE(EXCLUDED.notes, rh_pointages.notes), updated_at = now()
       RETURNING *`,
      [m.employe_id, m.date_jour, m.heure_arrivee || null, m.heure_depart || null, m.notes || null, req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'create', moduleCode: 'rh', entityType: 'pointage', entityId: rows[0].id, details: { source: 'manuel' }, ip: req.ip });
    res.status(201).json(rows[0]);
  })
);

export default router;

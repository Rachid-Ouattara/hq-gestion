import { pool, withTransaction } from './pool.js';
import { config } from '../config/index.js';
import { hashPassword } from '../lib/password.js';
import { MODULES, MODULE_CODES } from '../modules/business/registry.js';

const ROLES = [
  { code: 'admin', name: 'Administrateur', description: 'Accès complet + gestion des utilisateurs et rôles', is_system: true },
  { code: 'secretaire', name: 'Secrétaire', description: 'Saisie et gestion opérationnelle des modules', is_system: true },
  { code: 'direction', name: 'Supérieur / Direction', description: 'Validation, contrôle et décision', is_system: true },
  { code: 'formateur', name: 'Formateur', description: 'Accès restreint : planning et rapports de cours personnels', is_system: true },
  { code: 'employe', name: 'Employé', description: "Self-service : dossier personnel, congés, courrier, rapports d'activité", is_system: true },
];

/**
 * Matrice de droits par rôle. Reflète l'organigramme :
 * - Secrétaire : opère les modules métier, lecture seule sur le reporting, pas de validation.
 * - Direction : lecture + validation partout, lecture du reporting.
 * - Admin : tout.
 * - Formateur : lecture/création/modification sur le module formation uniquement — la
 *   restriction à ses propres séances/rapports est appliquée en base par les routes
 *   (voir `backend/src/modules/formation/scope.js`), pas par cette matrice module-grain.
 *   Il conserve en plus l'accès self-service RH/administrative ci-dessous (un formateur
 *   reste un employé : il a aussi un dossier, des congés, du courrier, des rapports
 *   d'activité) — restriction par fiche RH appliquée par `rh/scope.js`.
 * - Employé : self-service uniquement (dossier personnel, congés, courrier, rapports
 *   d'activité) — même restriction par fiche RH que le formateur, aucun accès aux
 *   autres modules métier.
 */
const SELF_SERVICE = { can_read: true, can_create: true, can_update: false, can_delete: false, can_validate: false };

function permissionsFor(roleCode, moduleCode) {
  const full = { can_read: true, can_create: true, can_update: true, can_delete: true, can_validate: true };
  const readOnly = { can_read: true, can_create: false, can_update: false, can_delete: false, can_validate: false };
  const none = { can_read: false, can_create: false, can_update: false, can_delete: false, can_validate: false };

  if (roleCode === 'admin') return full;

  if (roleCode === 'secretaire') {
    if (moduleCode === 'reporting') return readOnly;
    // Paie & Rémunérations : aucun accès par défaut (donnée sensible), configurable
    // ensuite rôle par rôle depuis Rôles & droits — ne doit pas hériter du droit
    // large accordé par défaut au reste des modules pour ce rôle.
    if (moduleCode === 'rh_paie') return none;
    return { can_read: true, can_create: true, can_update: true, can_delete: true, can_validate: false };
  }

  if (roleCode === 'direction') {
    if (moduleCode === 'reporting') return readOnly;
    return { can_read: true, can_create: false, can_update: false, can_delete: false, can_validate: true };
  }

  if (roleCode === 'formateur') {
    if (moduleCode === 'formation') return { can_read: true, can_create: true, can_update: true, can_delete: false, can_validate: false };
    if (moduleCode === 'rh' || moduleCode === 'administrative') return SELF_SERVICE;
    return none;
  }

  if (roleCode === 'employe') {
    if (moduleCode === 'rh' || moduleCode === 'administrative') return SELF_SERVICE;
    return none;
  }

  return none;
}

async function seed() {
  await withTransaction(async (client) => {
    // Rôles
    for (const r of ROLES) {
      await client.query(
        `INSERT INTO roles (code, name, description, is_system)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
        [r.code, r.name, r.description, r.is_system]
      );
    }

    // Modules
    for (const m of MODULES) {
      await client.query(
        `INSERT INTO modules (code, name, color, icon, sort_order, is_active)
         VALUES ($1,$2,$3,$4,$5,TRUE)
         ON CONFLICT (code) DO UPDATE
           SET name = EXCLUDED.name, color = EXCLUDED.color,
               icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order`,
        [m.code, m.name, m.color, m.icon, m.sort_order]
      );
    }

    // Permissions RBAC. Seul le rôle admin est forcé à chaque exécution (ses
    // droits ne sont de toute façon jamais éditables depuis Rôles & droits —
    // voir roles.routes.js). Tous les autres rôles — y compris les rôles
    // système non-admin (secrétaire, direction, formateur, employé), qui
    // RESTENT éditables depuis Rôles & droits — ne reçoivent une ligne que si
    // elle n'existe pas encore (ON CONFLICT DO NOTHING) : ça fournit un
    // défaut sensé pour un module tout juste ajouté au registre, sans jamais
    // écraser une personnalisation faite depuis l'interface. Avant ce
    // correctif, un reseed réinitialisait silencieusement à « aucun droit »
    // soit tout rôle personnalisé (bug initial), soit toute personnalisation
    // d'un rôle système non-admin (régression du premier correctif).
    const { rows: allRoleRows } = await client.query('SELECT id, code, is_system FROM roles');
    const roleRows = allRoleRows.filter((r) => r.is_system);
    for (const role of allRoleRows) {
      for (const moduleCode of MODULE_CODES) {
        const p = permissionsFor(role.code, moduleCode);
        const conflictClause = role.code === 'admin'
          ? `DO UPDATE SET
               can_read = EXCLUDED.can_read, can_create = EXCLUDED.can_create,
               can_update = EXCLUDED.can_update, can_delete = EXCLUDED.can_delete,
               can_validate = EXCLUDED.can_validate`
          : 'DO NOTHING';
        await client.query(
          `INSERT INTO role_module_permissions
             (role_id, module_code, can_read, can_create, can_update, can_delete, can_validate)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (role_id, module_code) ${conflictClause}`,
          [role.id, moduleCode, p.can_read, p.can_create, p.can_update, p.can_delete, p.can_validate]
        );
      }
    }

    // Compte administrateur
    const adminRole = roleRows.find((r) => r.code === 'admin');
    const hash = await hashPassword(config.seed.password);
    await client.query(
      `INSERT INTO users (email, password_hash, full_name, role_id, is_active)
       VALUES ($1,$2,$3,$4,TRUE)
       ON CONFLICT (email) DO NOTHING`,
      [config.seed.email, hash, config.seed.name, adminRole.id]
    );
  });

  console.log('Seed terminé.');
  console.log(`Admin : ${config.seed.email} / ${config.seed.password}`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

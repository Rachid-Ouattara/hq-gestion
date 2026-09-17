import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';
import { loadPermissions } from '../../middleware/rbac.js';
import { query } from '../../db/pool.js';

const router = Router();
router.use(authenticate);

// Catégories de recherche : chacune n'est exécutée que si l'appelant a le
// droit `read` sur le module d'origine — la recherche ne contourne jamais
// les permissions déjà en place, elle les recoupe.
const CATEGORIES = [
  {
    key: 'employes',
    label: 'Employés',
    moduleCode: 'rh',
    sql: `SELECT id, nom, prenom, matricule, poste
            FROM rh_employes
           WHERE nom ILIKE $1 OR prenom ILIKE $1 OR matricule ILIKE $1
           ORDER BY nom LIMIT 5`,
    toResult: (r) => ({ label: `${r.nom} ${r.prenom}`, sublabel: `${r.matricule} · ${r.poste}`, url: `/modules/rh/employes/${r.id}` }),
  },
  {
    key: 'candidats',
    label: 'Candidats',
    moduleCode: 'rh',
    sql: `SELECT id, nom, prenom, statut
            FROM rh_candidats
           WHERE nom ILIKE $1 OR prenom ILIKE $1
           ORDER BY nom LIMIT 5`,
    toResult: (r) => ({ label: `${r.nom} ${r.prenom}`, sublabel: `Candidature — ${r.statut}`, url: `/modules/rh/candidats/${r.id}` }),
  },
  {
    key: 'clients',
    label: 'Clients',
    moduleCode: 'commercial',
    sql: `SELECT id, nom, contact_nom
            FROM commercial_clients
           WHERE nom ILIKE $1
           ORDER BY nom LIMIT 5`,
    toResult: (r) => ({ label: r.nom, sublabel: r.contact_nom || 'Client', url: '/modules/commercial/clients' }),
  },
  {
    key: 'ecoles_cibles',
    label: 'Écoles ciblées',
    moduleCode: 'prospection',
    sql: `SELECT id, nom, ville
            FROM prospection_ecoles_cibles
           WHERE nom ILIKE $1
           ORDER BY nom LIMIT 5`,
    toResult: (r) => ({ label: r.nom, sublabel: r.ville || 'École ciblée', url: `/modules/prospection/ecoles-cibles/${r.id}` }),
  },
  {
    key: 'ecoles_partenaires',
    label: 'Écoles partenaires',
    moduleCode: 'formation',
    sql: `SELECT id, nom, ville
            FROM formation_ecoles
           WHERE nom ILIKE $1
           ORDER BY nom LIMIT 5`,
    toResult: (r) => ({ label: r.nom, sublabel: r.ville || 'École partenaire', url: `/modules/formation/ecoles/${r.id}` }),
  },
  {
    key: 'documents',
    label: 'Documents administratifs',
    moduleCode: 'administrative',
    sql: `SELECT id, titre, type_document
            FROM administrative_documents
           WHERE titre ILIKE $1
           ORDER BY titre LIMIT 5`,
    toResult: (r) => ({ label: r.titre, sublabel: r.type_document, url: `/modules/administrative/documents/${r.id}` }),
  },
];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const like = `%${q}%`;

    const perms = await loadPermissions(req.user.role_id);
    const allowed = CATEGORIES.filter((c) => perms[c.moduleCode]?.read);

    const results = await Promise.all(
      allowed.map(async (c) => {
        const { rows } = await query(c.sql, [like]);
        return { key: c.key, label: c.label, items: rows.map(c.toResult) };
      })
    );

    res.json(results.filter((r) => r.items.length > 0));
  })
);

export default router;

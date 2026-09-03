# HQ Gestion — Application de gestion Headquarters

Socle d'une application de gestion interne multi-modules, dérivée de l'organigramme
« Du Secrétaire jusqu'au PC ». Monorepo npm workspaces.

## Architecture

- **backend/** — API Node.js/Express + PostgreSQL
  - Auth JWT + refresh token à rotation
  - RBAC par module (matrice rôle × module × action)
  - Moteur de validation générique et découplé (couche Direction)
  - Journal d'audit (traçabilité des actions)
  - Registre des 7 modules métier
- **web/** — Frontend React (Vite) + Tailwind
  - Connexion, navigation filtrée par permissions, tableau de bord KPI
  - Page module générique (feuille de route + file de validation)
  - Administration : utilisateurs, matrice des rôles & droits
- **mobile/** — *(à venir)* Ionic React, même flux d'auth contre la même API

## Les 7 modules (organigramme)

| Module | Code | Sous-modules |
|---|---|---|
| Gestion Administrative | `administrative` | Courrier, Archivage, Documents, Agenda, Notes |
| Ressources Humaines | `rh` | Personnel, Congés, Paie, Évaluations, Formation |
| Gestion des Achats | `achats` | Demandes, Fournisseurs, Bons de commande, Réception, Paiements |
| Gestion des Stocks | `stocks` | Articles, Entrées, Sorties, Inventaires, Alertes |
| Gestion Financière | `finance` | Comptabilité, Recettes, Dépenses, Budgets, États |
| Gestion Commerciale | `commercial` | Clients, Devis, Commandes, Facturation, Encaissements |
| Tableaux de bord & Reporting | `reporting` | KPI, Analyses, Rapports, Export, Suivi |

## Rôles par défaut

- **Secrétaire** — saisit et gère les 6 modules opérationnels, lecture du reporting, **ne valide pas**.
- **Direction** — lecture + **validation/décision** sur tous les modules.
- **Administrateur** — accès complet + gestion des utilisateurs et des rôles.

La matrice est modifiable dans l'écran *Rôles & droits*.

## Prérequis

- Node.js ≥ 20
- PostgreSQL ≥ 13

## Installation

```bash
# À la racine du monorepo
npm install

# 1) Base de données
createdb hq_gestion

# 2) Configurer le backend
cp backend/.env.example backend/.env
#   → éditer DATABASE_URL et les secrets JWT

# 3) Migrer + seeder (crée rôles, modules, permissions et le compte admin)
npm run migrate
npm run seed
```

Le seed affiche les identifiants du compte administrateur
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, par défaut `admin@hq.bf` / `Admin@2026`).

## Lancement (développement)

```bash
npm run dev:api   # API sur http://localhost:4000
npm run dev:web   # Web sur http://localhost:5173 (proxy /api → 4000)
```

## Principaux points d'API

| Méthode | Route | Droit requis |
|---|---|---|
| POST | `/api/auth/login` | — |
| POST | `/api/auth/refresh` | — |
| GET | `/api/auth/me` | authentifié |
| GET | `/api/modules` | authentifié (filtré) |
| GET | `/api/modules/:code` | `read` sur le module |
| POST | `/api/modules/:code/submit` | `create` sur le module |
| GET | `/api/modules/:code/validations` | `validate` sur le module |
| POST | `/api/validations/:id/decide` | `validate` sur le module |
| GET | `/api/reporting/kpi` | `read` sur `reporting` |
| GET | `/api/reporting/audit` | admin |
| GET/POST/PATCH | `/api/users` | admin |
| GET/PUT | `/api/roles` | admin |

## Prochaines étapes

1. Implémenter un premier module métier de bout en bout (ex. Achats → Stocks).
2. Cloner le flux d'auth dans l'app Ionic (mobile/).
3. Brancher les intégrations (Mobile Money, exports PDF/Excel) selon les besoins.

-- ============================================================
-- HQ Gestion — Module Ressources Humaines
-- Employés, Congés, Paies, Évaluations, Formations
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS rh_conges_numero_seq;
CREATE SEQUENCE IF NOT EXISTS rh_paies_numero_seq;
CREATE SEQUENCE IF NOT EXISTS rh_evaluations_numero_seq;
CREATE SEQUENCE IF NOT EXISTS rh_formations_numero_seq;

-- ------------------------------------------------------------
-- Employés (dossier du personnel)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rh_employes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule      TEXT NOT NULL UNIQUE,
  nom            TEXT NOT NULL,
  prenom         TEXT NOT NULL,
  date_naissance DATE,
  telephone      TEXT,
  email          TEXT,
  adresse        TEXT,
  poste          TEXT NOT NULL,
  departement    TEXT,
  date_embauche  DATE NOT NULL DEFAULT CURRENT_DATE,
  type_contrat   TEXT NOT NULL CHECK (type_contrat IN ('cdi','cdd','stage','consultant')),
  salaire_base   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (salaire_base >= 0),
  statut         TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif','conge','suspendu','termine')),
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rh_employes_statut ON rh_employes(statut);
CREATE INDEX IF NOT EXISTS idx_rh_employes_departement ON rh_employes(departement);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_employes_user ON rh_employes(user_id) WHERE user_id IS NOT NULL;

-- ------------------------------------------------------------
-- Congés & absences (branché sur le moteur de validation générique)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rh_conges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        TEXT NOT NULL UNIQUE DEFAULT
    ('CONGE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('rh_conges_numero_seq')::text, 4, '0')),
  employe_id    UUID NOT NULL REFERENCES rh_employes(id),
  type_conge    TEXT NOT NULL CHECK (type_conge IN ('annuel','maladie','maternite','paternite','sans_solde','autre')),
  date_debut    DATE NOT NULL,
  date_fin      DATE NOT NULL,
  nombre_jours  NUMERIC(5,1) NOT NULL CHECK (nombre_jours > 0),
  motif         TEXT,
  statut        TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','soumise','validee','rejetee')),
  demandeur_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS idx_rh_conges_employe ON rh_conges(employe_id);
CREATE INDEX IF NOT EXISTS idx_rh_conges_statut ON rh_conges(statut);

-- ------------------------------------------------------------
-- Paies & Rémunérations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rh_paies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        TEXT NOT NULL UNIQUE DEFAULT
    ('PAIE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('rh_paies_numero_seq')::text, 4, '0')),
  employe_id    UUID NOT NULL REFERENCES rh_employes(id),
  periode       TEXT NOT NULL,
  salaire_base  NUMERIC(14,2) NOT NULL DEFAULT 0,
  primes        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (primes >= 0),
  deductions    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  salaire_net   NUMERIC(14,2) GENERATED ALWAYS AS (salaire_base + primes - deductions) STORED,
  statut        TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','payee')),
  date_paiement DATE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employe_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_rh_paies_periode ON rh_paies(periode);
CREATE INDEX IF NOT EXISTS idx_rh_paies_statut ON rh_paies(statut);

-- ------------------------------------------------------------
-- Évaluations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rh_evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            TEXT NOT NULL UNIQUE DEFAULT
    ('EVAL-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('rh_evaluations_numero_seq')::text, 4, '0')),
  employe_id        UUID NOT NULL REFERENCES rh_employes(id),
  evaluateur_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  periode           TEXT NOT NULL,
  score             NUMERIC(4,1) CHECK (score >= 0 AND score <= 20),
  points_forts      TEXT,
  axes_amelioration TEXT,
  commentaires      TEXT,
  statut            TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','finalisee')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employe_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_rh_evaluations_employe ON rh_evaluations(employe_id);

-- ------------------------------------------------------------
-- Formations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rh_formations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero      TEXT NOT NULL UNIQUE DEFAULT
    ('FORM-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('rh_formations_numero_seq')::text, 4, '0')),
  titre       TEXT NOT NULL,
  organisme   TEXT,
  lieu        TEXT,
  date_debut  DATE NOT NULL,
  date_fin    DATE NOT NULL,
  cout        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cout >= 0),
  statut      TEXT NOT NULL DEFAULT 'planifiee' CHECK (statut IN ('planifiee','en_cours','terminee','annulee')),
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS idx_rh_formations_statut ON rh_formations(statut);

CREATE TABLE IF NOT EXISTS rh_formations_participants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id         UUID NOT NULL REFERENCES rh_formations(id) ON DELETE CASCADE,
  employe_id           UUID NOT NULL REFERENCES rh_employes(id),
  statut_participation TEXT NOT NULL DEFAULT 'inscrit' CHECK (statut_participation IN ('inscrit','present','absent','certifie')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (formation_id, employe_id)
);

CREATE INDEX IF NOT EXISTS idx_rh_formations_participants_formation ON rh_formations_participants(formation_id);
CREATE INDEX IF NOT EXISTS idx_rh_formations_participants_employe ON rh_formations_participants(employe_id);

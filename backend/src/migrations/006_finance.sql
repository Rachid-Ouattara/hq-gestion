-- ============================================================
-- HQ Gestion — Module Gestion Financière
-- Comptes, Recettes, Dépenses, Budgets
-- Simplification v1 assumée : pas de comptabilité en partie double
-- (pas de débit/crédit apparié, pas de journal équilibré) — chaque
-- compte porte un solde net simple, incrémenté par les recettes et
-- décrémenté par les dépenses qui lui sont rattachées.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS finance_recettes_numero_seq;
CREATE SEQUENCE IF NOT EXISTS finance_depenses_numero_seq;
CREATE SEQUENCE IF NOT EXISTS finance_budgets_numero_seq;

-- ------------------------------------------------------------
-- Comptes (plan comptable simplifié)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance_comptes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  libelle    TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('actif','passif','charge','produit','capitaux')),
  solde      NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_comptes_type ON finance_comptes(type);

-- ------------------------------------------------------------
-- Budgets (avant les dépenses, référencées par budget_id)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance_budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        TEXT NOT NULL UNIQUE DEFAULT
    ('BUD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('finance_budgets_numero_seq')::text, 4, '0')),
  exercice      TEXT NOT NULL,
  libelle       TEXT NOT NULL,
  departement   TEXT,
  montant_prevu NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (montant_prevu >= 0),
  statut        TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif','cloture')),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_budgets_exercice ON finance_budgets(exercice);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_statut ON finance_budgets(statut);

-- ------------------------------------------------------------
-- Recettes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance_recettes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        TEXT NOT NULL UNIQUE DEFAULT
    ('RCT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('finance_recettes_numero_seq')::text, 4, '0')),
  compte_id     UUID NOT NULL REFERENCES finance_comptes(id),
  date_recette  DATE NOT NULL DEFAULT CURRENT_DATE,
  source        TEXT NOT NULL,
  montant       NUMERIC(14,2) NOT NULL CHECK (montant > 0),
  reference     TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_recettes_compte ON finance_recettes(compte_id);
CREATE INDEX IF NOT EXISTS idx_finance_recettes_date ON finance_recettes(date_recette);

-- ------------------------------------------------------------
-- Dépenses
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance_depenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        TEXT NOT NULL UNIQUE DEFAULT
    ('DEP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('finance_depenses_numero_seq')::text, 4, '0')),
  compte_id     UUID NOT NULL REFERENCES finance_comptes(id),
  budget_id     UUID REFERENCES finance_budgets(id),
  date_depense  DATE NOT NULL DEFAULT CURRENT_DATE,
  categorie     TEXT NOT NULL CHECK (categorie IN ('loyer','electricite','eau','fournitures','salaires','transport','autre')),
  libelle       TEXT NOT NULL,
  montant       NUMERIC(14,2) NOT NULL CHECK (montant > 0),
  reference     TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_depenses_compte ON finance_depenses(compte_id);
CREATE INDEX IF NOT EXISTS idx_finance_depenses_budget ON finance_depenses(budget_id);
CREATE INDEX IF NOT EXISTS idx_finance_depenses_date ON finance_depenses(date_depense);

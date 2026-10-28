-- ============================================================
-- HQ Gestion — Charges récurrentes (loyer, salaires…)
-- Alimente le prévisionnel de trésorerie : `prochaine_echeance` est une
-- ancre jamais réécrite, combinée à `periodicite` pour projeter toutes
-- les occurrences futures via generate_series côté requête.
-- ============================================================

CREATE TABLE IF NOT EXISTS finance_charges_recurrentes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle            TEXT NOT NULL,
  montant            NUMERIC(14,2) NOT NULL CHECK (montant > 0),
  periodicite        TEXT NOT NULL CHECK (periodicite IN ('mensuelle', 'trimestrielle', 'annuelle')),
  prochaine_echeance DATE NOT NULL,
  actif              BOOLEAN NOT NULL DEFAULT TRUE,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_charges_recurrentes_actif ON finance_charges_recurrentes(actif);

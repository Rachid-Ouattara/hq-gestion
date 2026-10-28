-- ============================================================
-- HQ Gestion — Paramètres entreprise
-- Coordonnées utilisées en en-tête des documents PDF (factures,
-- devis, bons de commande, bulletins de paie). Table singleton,
-- même pattern que rh_parametres_pointage.
-- ============================================================

CREATE TABLE IF NOT EXISTS parametres_entreprise (
  id            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nom_legal     TEXT NOT NULL DEFAULT 'Headquarters',
  adresse       TEXT,
  telephone     TEXT,
  email         TEXT,
  numero_fiscal TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO parametres_entreprise (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

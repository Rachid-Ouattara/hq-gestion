-- ============================================================
-- HQ Gestion — Module Achats
-- Fournisseurs, Demandes d'achat, Bons de commande, Réceptions, Paiements
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS demandes_achat_numero_seq;
CREATE SEQUENCE IF NOT EXISTS bons_de_commande_numero_seq;
CREATE SEQUENCE IF NOT EXISTS receptions_numero_seq;
CREATE SEQUENCE IF NOT EXISTS paiements_numero_seq;

-- ------------------------------------------------------------
-- Fournisseurs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fournisseurs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom            TEXT NOT NULL,
  contact_nom    TEXT,
  telephone      TEXT,
  email          TEXT,
  adresse        TEXT,
  numero_fiscal  TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fournisseurs_nom ON fournisseurs(nom);

-- ------------------------------------------------------------
-- Demandes d'achat
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demandes_achat (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                 TEXT NOT NULL UNIQUE DEFAULT
    ('DA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('demandes_achat_numero_seq')::text, 4, '0')),
  objet                  TEXT NOT NULL,
  justification          TEXT,
  demandeur_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  fournisseur_suggere_id UUID REFERENCES fournisseurs(id),
  montant_estime         NUMERIC(14,2) NOT NULL DEFAULT 0,
  statut                 TEXT NOT NULL DEFAULT 'brouillon'
                           CHECK (statut IN ('brouillon','soumise','validee','rejetee')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demandes_statut ON demandes_achat(statut);
CREATE INDEX IF NOT EXISTS idx_demandes_demandeur ON demandes_achat(demandeur_id);

CREATE TABLE IF NOT EXISTS demandes_achat_lignes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id           UUID NOT NULL REFERENCES demandes_achat(id) ON DELETE CASCADE,
  designation          TEXT NOT NULL,
  quantite             NUMERIC(12,2) NOT NULL CHECK (quantite > 0),
  unite                TEXT,
  prix_estime_unitaire NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (prix_estime_unitaire >= 0),
  montant_estime        NUMERIC(14,2) GENERATED ALWAYS AS (quantite * prix_estime_unitaire) STORED,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demandes_lignes_demande ON demandes_achat_lignes(demande_id);

-- ------------------------------------------------------------
-- Bons de commande
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bons_de_commande (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero               TEXT NOT NULL UNIQUE DEFAULT
    ('BC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('bons_de_commande_numero_seq')::text, 4, '0')),
  demande_id           UUID REFERENCES demandes_achat(id),
  fournisseur_id       UUID NOT NULL REFERENCES fournisseurs(id),
  date_commande        DATE NOT NULL DEFAULT CURRENT_DATE,
  devise               TEXT NOT NULL DEFAULT 'XOF',
  conditions_livraison TEXT,
  montant_total        NUMERIC(14,2) NOT NULL DEFAULT 0,
  statut               TEXT NOT NULL DEFAULT 'brouillon'
                         CHECK (statut IN ('brouillon','envoyee','receptionnee_partielle','receptionnee_complete','annule')),
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bc_statut ON bons_de_commande(statut);
CREATE INDEX IF NOT EXISTS idx_bc_fournisseur ON bons_de_commande(fournisseur_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bc_demande_unique ON bons_de_commande(demande_id) WHERE demande_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bons_de_commande_lignes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bon_id        UUID NOT NULL REFERENCES bons_de_commande(id) ON DELETE CASCADE,
  designation   TEXT NOT NULL,
  quantite      NUMERIC(12,2) NOT NULL CHECK (quantite > 0),
  unite         TEXT,
  prix_unitaire NUMERIC(14,2) NOT NULL CHECK (prix_unitaire >= 0),
  montant       NUMERIC(14,2) GENERATED ALWAYS AS (quantite * prix_unitaire) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bc_lignes_bon ON bons_de_commande_lignes(bon_id);

-- ------------------------------------------------------------
-- Réceptions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE DEFAULT
    ('REC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('receptions_numero_seq')::text, 4, '0')),
  bon_id          UUID NOT NULL REFERENCES bons_de_commande(id),
  date_reception  DATE NOT NULL DEFAULT CURRENT_DATE,
  type            TEXT NOT NULL DEFAULT 'complete' CHECK (type IN ('complete','partielle')),
  receptionne_par UUID REFERENCES users(id) ON DELETE SET NULL,
  observations    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receptions_bon ON receptions(bon_id);

CREATE TABLE IF NOT EXISTS receptions_lignes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id   UUID NOT NULL REFERENCES receptions(id) ON DELETE CASCADE,
  bon_ligne_id   UUID NOT NULL REFERENCES bons_de_commande_lignes(id),
  quantite_recue NUMERIC(12,2) NOT NULL CHECK (quantite_recue > 0),
  etat           TEXT NOT NULL DEFAULT 'conforme' CHECK (etat IN ('conforme','endommage','manquant')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receptions_lignes_reception ON receptions_lignes(reception_id);
CREATE INDEX IF NOT EXISTS idx_receptions_lignes_bonligne ON receptions_lignes(bon_ligne_id);

-- ------------------------------------------------------------
-- Paiements
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paiements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         TEXT NOT NULL UNIQUE DEFAULT
    ('PAI-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('paiements_numero_seq')::text, 4, '0')),
  bon_id         UUID NOT NULL REFERENCES bons_de_commande(id),
  montant        NUMERIC(14,2) NOT NULL CHECK (montant > 0),
  date_paiement  DATE NOT NULL DEFAULT CURRENT_DATE,
  mode           TEXT NOT NULL CHECK (mode IN ('especes','virement','cheque','mobile_money')),
  reference      TEXT,
  enregistre_par UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paiements_bon ON paiements(bon_id);

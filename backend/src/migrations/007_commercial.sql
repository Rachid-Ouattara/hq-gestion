-- ============================================================
-- HQ Gestion — Module Gestion Commerciale
-- Clients, Devis, Commandes, Facturation, Encaissements
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS commercial_devis_numero_seq;
CREATE SEQUENCE IF NOT EXISTS commercial_commandes_numero_seq;
CREATE SEQUENCE IF NOT EXISTS commercial_factures_numero_seq;
CREATE SEQUENCE IF NOT EXISTS commercial_encaissements_numero_seq;

-- ------------------------------------------------------------
-- Clients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commercial_clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           TEXT NOT NULL,
  contact_nom   TEXT,
  telephone     TEXT,
  email         TEXT,
  adresse       TEXT,
  numero_fiscal TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_clients_nom ON commercial_clients(nom);

-- ------------------------------------------------------------
-- Devis
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commercial_devis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE DEFAULT
    ('DEV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('commercial_devis_numero_seq')::text, 4, '0')),
  objet           TEXT NOT NULL,
  client_id       UUID NOT NULL REFERENCES commercial_clients(id),
  date_devis      DATE NOT NULL DEFAULT CURRENT_DATE,
  validite_jours  INTEGER NOT NULL DEFAULT 30,
  montant_total   NUMERIC(14,2) NOT NULL DEFAULT 0,
  statut          TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','envoye','accepte','refuse','expire')),
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_devis_statut ON commercial_devis(statut);
CREATE INDEX IF NOT EXISTS idx_commercial_devis_client ON commercial_devis(client_id);

CREATE TABLE IF NOT EXISTS commercial_devis_lignes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id      UUID NOT NULL REFERENCES commercial_devis(id) ON DELETE CASCADE,
  designation   TEXT NOT NULL,
  quantite      NUMERIC(12,2) NOT NULL CHECK (quantite > 0),
  unite         TEXT,
  prix_unitaire NUMERIC(14,2) NOT NULL CHECK (prix_unitaire >= 0),
  montant       NUMERIC(14,2) GENERATED ALWAYS AS (quantite * prix_unitaire) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_devis_lignes_devis ON commercial_devis_lignes(devis_id);

-- ------------------------------------------------------------
-- Commandes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commercial_commandes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero               TEXT NOT NULL UNIQUE DEFAULT
    ('CMD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('commercial_commandes_numero_seq')::text, 4, '0')),
  devis_id             UUID REFERENCES commercial_devis(id),
  client_id            UUID NOT NULL REFERENCES commercial_clients(id),
  date_commande        DATE NOT NULL DEFAULT CURRENT_DATE,
  devise               TEXT NOT NULL DEFAULT 'XOF',
  conditions_livraison TEXT,
  montant_total        NUMERIC(14,2) NOT NULL DEFAULT 0,
  statut               TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','confirmee','livree','facturee','annulee')),
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_commandes_statut ON commercial_commandes(statut);
CREATE INDEX IF NOT EXISTS idx_commercial_commandes_client ON commercial_commandes(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_commandes_devis_unique ON commercial_commandes(devis_id) WHERE devis_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS commercial_commandes_lignes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id   UUID NOT NULL REFERENCES commercial_commandes(id) ON DELETE CASCADE,
  designation   TEXT NOT NULL,
  quantite      NUMERIC(12,2) NOT NULL CHECK (quantite > 0),
  unite         TEXT,
  prix_unitaire NUMERIC(14,2) NOT NULL CHECK (prix_unitaire >= 0),
  montant       NUMERIC(14,2) GENERATED ALWAYS AS (quantite * prix_unitaire) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_commandes_lignes_commande ON commercial_commandes_lignes(commande_id);

-- ------------------------------------------------------------
-- Facturation
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commercial_factures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        TEXT NOT NULL UNIQUE DEFAULT
    ('FAC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('commercial_factures_numero_seq')::text, 4, '0')),
  commande_id   UUID REFERENCES commercial_commandes(id),
  client_id     UUID NOT NULL REFERENCES commercial_clients(id),
  date_facture  DATE NOT NULL DEFAULT CURRENT_DATE,
  echeance      DATE,
  montant_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  statut        TEXT NOT NULL DEFAULT 'emise' CHECK (statut IN ('emise','partiellement_payee','payee','annulee')),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_factures_statut ON commercial_factures(statut);
CREATE INDEX IF NOT EXISTS idx_commercial_factures_client ON commercial_factures(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_factures_commande_unique ON commercial_factures(commande_id) WHERE commande_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS commercial_factures_lignes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id    UUID NOT NULL REFERENCES commercial_factures(id) ON DELETE CASCADE,
  designation   TEXT NOT NULL,
  quantite      NUMERIC(12,2) NOT NULL CHECK (quantite > 0),
  unite         TEXT,
  prix_unitaire NUMERIC(14,2) NOT NULL CHECK (prix_unitaire >= 0),
  montant       NUMERIC(14,2) GENERATED ALWAYS AS (quantite * prix_unitaire) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_factures_lignes_facture ON commercial_factures_lignes(facture_id);

-- ------------------------------------------------------------
-- Encaissements (avec lien optionnel vers un compte Finance)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commercial_encaissements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            TEXT NOT NULL UNIQUE DEFAULT
    ('ENC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('commercial_encaissements_numero_seq')::text, 4, '0')),
  facture_id        UUID NOT NULL REFERENCES commercial_factures(id),
  compte_id         UUID REFERENCES finance_comptes(id),
  montant           NUMERIC(14,2) NOT NULL CHECK (montant > 0),
  date_encaissement DATE NOT NULL DEFAULT CURRENT_DATE,
  mode              TEXT NOT NULL CHECK (mode IN ('especes','virement','cheque','mobile_money')),
  reference         TEXT,
  enregistre_par    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_encaissements_facture ON commercial_encaissements(facture_id);

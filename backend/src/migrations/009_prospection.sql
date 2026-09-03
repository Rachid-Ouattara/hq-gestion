-- ============================================================
-- HQ Gestion — Module Prospection
-- Campagnes, Groupes, Écoles ciblées, Rapports de visite
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS prospection_rapports_numero_seq;

-- ------------------------------------------------------------
-- Campagnes de prospection
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospection_campagnes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  annee      INTEGER NOT NULL,
  date_debut DATE NOT NULL,
  date_fin   DATE NOT NULL,
  statut     TEXT NOT NULL DEFAULT 'active' CHECK (statut IN ('active','cloturee')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS idx_prospection_campagnes_statut ON prospection_campagnes(statut);
CREATE INDEX IF NOT EXISTS idx_prospection_campagnes_annee ON prospection_campagnes(annee);

-- ------------------------------------------------------------
-- Groupes de prospection (par campagne)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospection_groupes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campagne_id UUID NOT NULL REFERENCES prospection_campagnes(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campagne_id, nom)
);

CREATE INDEX IF NOT EXISTS idx_prospection_groupes_campagne ON prospection_groupes(campagne_id);

CREATE TABLE IF NOT EXISTS prospection_groupes_membres (
  groupe_id  UUID NOT NULL REFERENCES prospection_groupes(id) ON DELETE CASCADE,
  employe_id UUID NOT NULL REFERENCES rh_employes(id) ON DELETE CASCADE,
  PRIMARY KEY (groupe_id, employe_id)
);

CREATE INDEX IF NOT EXISTS idx_prospection_groupes_membres_employe ON prospection_groupes_membres(employe_id);

-- ------------------------------------------------------------
-- Écoles ciblées
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospection_ecoles_cibles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campagne_id         UUID NOT NULL REFERENCES prospection_campagnes(id) ON DELETE CASCADE,
  groupe_id           UUID REFERENCES prospection_groupes(id) ON DELETE SET NULL,
  nom                 TEXT NOT NULL,
  ville               TEXT,
  contact_nom         TEXT,
  contact_telephone   TEXT,
  contact_email       TEXT,
  statut              TEXT NOT NULL DEFAULT 'a_contacter'
                        CHECK (statut IN ('a_contacter','contacte','interesse','en_negociation','partenaire','refuse','abandonne')),
  notes               TEXT,
  ecole_partenaire_id UUID REFERENCES formation_ecoles(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospection_ecoles_cibles_campagne ON prospection_ecoles_cibles(campagne_id);
CREATE INDEX IF NOT EXISTS idx_prospection_ecoles_cibles_groupe ON prospection_ecoles_cibles(groupe_id);
CREATE INDEX IF NOT EXISTS idx_prospection_ecoles_cibles_statut ON prospection_ecoles_cibles(statut);

-- ------------------------------------------------------------
-- Rapports de visite/contact
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospection_rapports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           TEXT NOT NULL UNIQUE DEFAULT
    ('RAPPRO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('prospection_rapports_numero_seq')::text, 4, '0')),
  ecole_cible_id   UUID NOT NULL REFERENCES prospection_ecoles_cibles(id) ON DELETE CASCADE,
  date_contact     DATE NOT NULL DEFAULT CURRENT_DATE,
  resume           TEXT NOT NULL,
  resultat         TEXT,
  prochaine_action TEXT,
  redige_par       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospection_rapports_ecole_cible ON prospection_rapports(ecole_cible_id);
CREATE INDEX IF NOT EXISTS idx_prospection_rapports_date ON prospection_rapports(date_contact);

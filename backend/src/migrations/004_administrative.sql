-- ============================================================
-- HQ Gestion — Module Gestion Administrative
-- Archives, Courrier, Documents, Agenda, Notes
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS administrative_courrier_numero_seq;
CREATE SEQUENCE IF NOT EXISTS administrative_documents_numero_seq;
CREATE SEQUENCE IF NOT EXISTS administrative_notes_numero_seq;

-- ------------------------------------------------------------
-- Archives (plan de classement)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS administrative_archives (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT NOT NULL UNIQUE,
  libelle        TEXT NOT NULL,
  type_support   TEXT NOT NULL DEFAULT 'physique' CHECK (type_support IN ('physique','numerique')),
  emplacement    TEXT,
  responsable_id UUID REFERENCES users(id) ON DELETE SET NULL,
  statut         TEXT NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','clos')),
  date_ouverture DATE NOT NULL DEFAULT CURRENT_DATE,
  date_cloture   DATE,
  observations   TEXT,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_archives_statut ON administrative_archives(statut);

-- ------------------------------------------------------------
-- Courrier (entrée + sortie, table unique via `sens`)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS administrative_courrier (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            TEXT NOT NULL UNIQUE DEFAULT
    ('COUR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('administrative_courrier_numero_seq')::text, 4, '0')),
  sens              TEXT NOT NULL CHECK (sens IN ('entrant','sortant')),
  objet             TEXT NOT NULL,
  correspondant     TEXT NOT NULL,
  date_courrier     DATE NOT NULL DEFAULT CURRENT_DATE,
  mode_transmission TEXT,
  traite_par        UUID REFERENCES users(id) ON DELETE SET NULL,
  statut            TEXT NOT NULL DEFAULT 'nouveau' CHECK (statut IN ('nouveau','en_traitement','traite','archive')),
  archive_id        UUID REFERENCES administrative_archives(id),
  observations      TEXT,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_courrier_sens ON administrative_courrier(sens);
CREATE INDEX IF NOT EXISTS idx_admin_courrier_statut ON administrative_courrier(statut);
CREATE INDEX IF NOT EXISTS idx_admin_courrier_archive ON administrative_courrier(archive_id);

-- ------------------------------------------------------------
-- Documents administratifs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS administrative_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         TEXT NOT NULL UNIQUE DEFAULT
    ('DOC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('administrative_documents_numero_seq')::text, 4, '0')),
  type_document  TEXT NOT NULL CHECK (type_document IN ('contrat','certificat','proces_verbal','attestation','autre')),
  titre          TEXT NOT NULL,
  description    TEXT,
  date_document  DATE NOT NULL DEFAULT CURRENT_DATE,
  date_expiration DATE,
  statut         TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif','expire','archive')),
  archive_id     UUID REFERENCES administrative_archives(id),
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_documents_type ON administrative_documents(type_document);
CREATE INDEX IF NOT EXISTS idx_admin_documents_statut ON administrative_documents(statut);
CREATE INDEX IF NOT EXISTS idx_admin_documents_archive ON administrative_documents(archive_id);

-- ------------------------------------------------------------
-- Agenda & Rendez-vous
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS administrative_agenda (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre        TEXT NOT NULL,
  description  TEXT,
  date_debut   TIMESTAMPTZ NOT NULL,
  date_fin     TIMESTAMPTZ NOT NULL,
  lieu         TEXT,
  participants TEXT,
  statut       TEXT NOT NULL DEFAULT 'planifie' CHECK (statut IN ('planifie','termine','annule')),
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS idx_admin_agenda_debut ON administrative_agenda(date_debut);

-- ------------------------------------------------------------
-- Notes & Mémos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS administrative_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        TEXT NOT NULL UNIQUE DEFAULT
    ('NOTE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('administrative_notes_numero_seq')::text, 4, '0')),
  objet         TEXT NOT NULL,
  contenu       TEXT NOT NULL,
  destinataires TEXT,
  date_note     DATE NOT NULL DEFAULT CURRENT_DATE,
  statut        TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','diffusee')),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notes_statut ON administrative_notes(statut);

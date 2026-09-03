CREATE SEQUENCE IF NOT EXISTS rh_postes_numero_seq;
CREATE TABLE IF NOT EXISTS rh_postes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         TEXT NOT NULL UNIQUE DEFAULT
    ('POSTE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('rh_postes_numero_seq')::text, 4, '0')),
  titre          TEXT NOT NULL,
  departement    TEXT,
  type_contrat   TEXT NOT NULL CHECK (type_contrat IN ('cdi','cdd','stage','consultant')),
  description    TEXT,
  nombre_postes  INTEGER NOT NULL DEFAULT 1,
  statut         TEXT NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','pourvu','annule')),
  date_ouverture DATE NOT NULL DEFAULT CURRENT_DATE,
  date_cloture   DATE,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS rh_candidats_numero_seq;
CREATE TABLE IF NOT EXISTS rh_candidats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero     TEXT NOT NULL UNIQUE DEFAULT
    ('CAND-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('rh_candidats_numero_seq')::text, 4, '0')),
  poste_id   UUID NOT NULL REFERENCES rh_postes(id) ON DELETE CASCADE,
  nom        TEXT NOT NULL,
  prenom     TEXT NOT NULL,
  email      TEXT,
  telephone  TEXT,
  source     TEXT,
  statut     TEXT NOT NULL DEFAULT 'recu' CHECK (statut IN ('recu','preselection','entretien','offre','embauche','refuse')),
  notes      TEXT,
  employe_id UUID REFERENCES rh_employes(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_candidats_poste ON rh_candidats(poste_id);

CREATE TABLE IF NOT EXISTS rh_entretiens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidat_id    UUID NOT NULL REFERENCES rh_candidats(id) ON DELETE CASCADE,
  evaluateur_id  UUID REFERENCES rh_employes(id),
  date_entretien DATE NOT NULL,
  heure_debut    TIME,
  heure_fin      TIME,
  mode           TEXT NOT NULL DEFAULT 'presentiel' CHECK (mode IN ('presentiel','visio')),
  statut         TEXT NOT NULL DEFAULT 'planifie' CHECK (statut IN ('planifie','realise','annule')),
  score          NUMERIC,
  commentaire    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_entretiens_candidat ON rh_entretiens(candidat_id);

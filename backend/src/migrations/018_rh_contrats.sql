CREATE SEQUENCE IF NOT EXISTS rh_contrats_numero_seq;
CREATE TABLE IF NOT EXISTS rh_contrats (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero               TEXT NOT NULL UNIQUE DEFAULT
    ('CONTRAT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('rh_contrats_numero_seq')::text, 4, '0')),
  employe_id           UUID NOT NULL REFERENCES rh_employes(id) ON DELETE CASCADE,
  type_contrat         TEXT NOT NULL CHECK (type_contrat IN ('cdi','cdd','stage','consultant')),
  poste                TEXT,
  date_debut           DATE NOT NULL,
  date_fin             DATE,
  salaire_base         NUMERIC NOT NULL DEFAULT 0,
  statut               TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif','expire','resilie','renouvele')),
  notes                TEXT,
  contrat_precedent_id UUID REFERENCES rh_contrats(id) ON DELETE SET NULL,
  created_by           UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_contrats_employe ON rh_contrats(employe_id);

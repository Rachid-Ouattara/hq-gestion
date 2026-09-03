ALTER TABLE rh_employes ADD COLUMN IF NOT EXISTS photo_chemin TEXT;
ALTER TABLE rh_employes ADD COLUMN IF NOT EXISTS responsable_id UUID REFERENCES rh_employes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_rh_employes_responsable ON rh_employes(responsable_id);

CREATE SEQUENCE IF NOT EXISTS rh_rapports_activite_numero_seq;

CREATE TABLE IF NOT EXISTS rh_rapports_activite (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero       TEXT NOT NULL UNIQUE DEFAULT
    ('ACT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('rh_rapports_activite_numero_seq')::text, 4, '0')),
  employe_id   UUID NOT NULL REFERENCES rh_employes(id) ON DELETE CASCADE,
  periode_debut DATE NOT NULL,
  periode_fin   DATE NOT NULL,
  contenu       TEXT NOT NULL,
  difficultes   TEXT,
  statut        TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','soumis','valide','rejete')),
  commentaire_responsable TEXT,
  lu_par        UUID REFERENCES users(id),
  lu_le         TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (periode_fin >= periode_debut)
);

CREATE INDEX IF NOT EXISTS idx_rh_rapports_activite_employe ON rh_rapports_activite(employe_id);

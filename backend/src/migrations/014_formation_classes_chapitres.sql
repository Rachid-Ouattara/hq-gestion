CREATE TABLE IF NOT EXISTS formation_classes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id   UUID NOT NULL REFERENCES formation_ecoles(id) ON DELETE CASCADE,
  nom        TEXT NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ecole_id, nom)
);
CREATE INDEX IF NOT EXISTS idx_formation_classes_ecole ON formation_classes(ecole_id);

CREATE TABLE IF NOT EXISTS formation_chapitres (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_id   UUID NOT NULL REFERENCES formation_classes(id) ON DELETE CASCADE,
  domaine     TEXT NOT NULL CHECK (domaine IN ('ia','informatique','robotique','drone')),
  titre       TEXT NOT NULL,
  description TEXT,
  ordre       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_formation_chapitres_classe_domaine ON formation_chapitres(classe_id, domaine);

ALTER TABLE formation_seances ADD COLUMN IF NOT EXISTS classe_id UUID REFERENCES formation_classes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS formation_rapports_chapitres (
  rapport_id  UUID NOT NULL REFERENCES formation_rapports_cours(id) ON DELETE CASCADE,
  chapitre_id UUID NOT NULL REFERENCES formation_chapitres(id) ON DELETE CASCADE,
  PRIMARY KEY (rapport_id, chapitre_id)
);

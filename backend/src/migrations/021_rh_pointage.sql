CREATE TABLE IF NOT EXISTS rh_ip_autorisees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  ip_ou_cidr TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rh_parametres_pointage (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  heure_arrivee_attendue TIME NOT NULL DEFAULT '08:00',
  tolerance_minutes INTEGER NOT NULL DEFAULT 15
);
INSERT INTO rh_parametres_pointage (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS rh_pointages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id    UUID NOT NULL REFERENCES rh_employes(id) ON DELETE CASCADE,
  date_jour     DATE NOT NULL DEFAULT CURRENT_DATE,
  heure_arrivee TIMESTAMPTZ,
  heure_depart  TIMESTAMPTZ,
  ip_arrivee    TEXT,
  ip_depart     TEXT,
  source        TEXT NOT NULL DEFAULT 'logiciel' CHECK (source IN ('logiciel','manuel','appareil')),
  statut        TEXT NOT NULL DEFAULT 'present' CHECK (statut IN ('present','retard')),
  notes         TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employe_id, date_jour)
);

CREATE INDEX IF NOT EXISTS idx_rh_pointages_date ON rh_pointages(date_jour);

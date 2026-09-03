-- ============================================================
-- HQ Gestion — Module Formation & Écoles Partenaires
-- Écoles, Salles, Équipements, Camps, Formateurs (domaines),
-- Séances, Rapports de cours, Maintenance
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS formation_seances_numero_seq;
CREATE SEQUENCE IF NOT EXISTS formation_rapports_numero_seq;
CREATE SEQUENCE IF NOT EXISTS formation_maintenance_numero_seq;

-- ------------------------------------------------------------
-- Écoles partenaires
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formation_ecoles (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom                    TEXT NOT NULL,
  ville                  TEXT NOT NULL,
  adresse                TEXT,
  contact_nom            TEXT,
  contact_telephone      TEXT,
  contact_email          TEXT,
  statut_partenariat     TEXT NOT NULL DEFAULT 'actif' CHECK (statut_partenariat IN ('actif','suspendu','termine')),
  date_debut_partenariat DATE,
  notes                  TEXT,
  created_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formation_ecoles_ville ON formation_ecoles(ville);
CREATE INDEX IF NOT EXISTS idx_formation_ecoles_statut ON formation_ecoles(statut_partenariat);

-- ------------------------------------------------------------
-- Salles (par école)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formation_salles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id   UUID NOT NULL REFERENCES formation_ecoles(id) ON DELETE CASCADE,
  nom        TEXT NOT NULL,
  capacite   INTEGER CHECK (capacite > 0),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ecole_id, nom)
);

CREATE INDEX IF NOT EXISTS idx_formation_salles_ecole ON formation_salles(ecole_id);

-- ------------------------------------------------------------
-- Équipements (inventaire par unité, par salle)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formation_equipements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salle_id          UUID NOT NULL REFERENCES formation_salles(id) ON DELETE CASCADE,
  type_equipement   TEXT NOT NULL CHECK (type_equipement IN ('pc','kit_robotique','drone','tv_interactive','climatiseur','reseau','autre')),
  designation       TEXT NOT NULL,
  numero_serie      TEXT,
  date_installation DATE,
  etat              TEXT NOT NULL DEFAULT 'fonctionnel' CHECK (etat IN ('fonctionnel','en_panne','en_reparation','hors_service')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_formation_equipements_numero_serie ON formation_equipements(numero_serie) WHERE numero_serie IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_formation_equipements_salle ON formation_equipements(salle_id);
CREATE INDEX IF NOT EXISTS idx_formation_equipements_etat ON formation_equipements(etat);

-- ------------------------------------------------------------
-- Camps de vacances
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formation_camps (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom                TEXT NOT NULL,
  lieu               TEXT NOT NULL,
  ville              TEXT,
  date_debut         DATE NOT NULL,
  date_fin           DATE NOT NULL,
  responsable_nom    TEXT,
  responsable_telephone TEXT,
  statut             TEXT NOT NULL DEFAULT 'planifie' CHECK (statut IN ('planifie','en_cours','termine','annule')),
  notes              TEXT,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS idx_formation_camps_statut ON formation_camps(statut);
CREATE INDEX IF NOT EXISTS idx_formation_camps_dates ON formation_camps(date_debut, date_fin);

-- ------------------------------------------------------------
-- Domaines de spécialité des formateurs (many-to-many sur rh_employes)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formation_formateur_domaines (
  employe_id UUID NOT NULL REFERENCES rh_employes(id) ON DELETE CASCADE,
  domaine    TEXT NOT NULL CHECK (domaine IN ('ia','informatique','robotique','drone')),
  PRIMARY KEY (employe_id, domaine)
);

CREATE INDEX IF NOT EXISTS idx_formation_formateur_domaines_domaine ON formation_formateur_domaines(domaine);

-- ------------------------------------------------------------
-- Séances (planning)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formation_seances (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         TEXT NOT NULL UNIQUE DEFAULT
    ('SEANCE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('formation_seances_numero_seq')::text, 4, '0')),
  date_seance    DATE NOT NULL,
  heure_debut    TIME NOT NULL,
  heure_fin      TIME NOT NULL,
  lieu_type      TEXT NOT NULL CHECK (lieu_type IN ('ecole','camp')),
  ecole_id       UUID REFERENCES formation_ecoles(id),
  salle_id       UUID REFERENCES formation_salles(id),
  camp_id        UUID REFERENCES formation_camps(id),
  domaine        TEXT NOT NULL CHECK (domaine IN ('ia','informatique','robotique','drone')),
  formateur_id   UUID NOT NULL REFERENCES rh_employes(id),
  groupe         TEXT,
  effectif_prevu INTEGER CHECK (effectif_prevu >= 0),
  statut         TEXT NOT NULL DEFAULT 'planifiee' CHECK (statut IN ('planifiee','realisee','annulee')),
  notes          TEXT,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (heure_fin > heure_debut),
  CHECK (
    (lieu_type = 'ecole' AND ecole_id IS NOT NULL AND salle_id IS NOT NULL AND camp_id IS NULL)
    OR
    (lieu_type = 'camp' AND camp_id IS NOT NULL AND ecole_id IS NULL AND salle_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_formation_seances_formateur_date ON formation_seances(formateur_id, date_seance);
CREATE INDEX IF NOT EXISTS idx_formation_seances_ecole ON formation_seances(ecole_id);
CREATE INDEX IF NOT EXISTS idx_formation_seances_camp ON formation_seances(camp_id);
CREATE INDEX IF NOT EXISTS idx_formation_seances_date ON formation_seances(date_seance);
CREATE INDEX IF NOT EXISTS idx_formation_seances_statut ON formation_seances(statut);

-- ------------------------------------------------------------
-- Rapports de cours (un par séance réalisée)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formation_rapports_cours (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         TEXT NOT NULL UNIQUE DEFAULT
    ('RAPPORT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('formation_rapports_numero_seq')::text, 4, '0')),
  seance_id      UUID NOT NULL UNIQUE REFERENCES formation_seances(id),
  formateur_id   UUID NOT NULL REFERENCES rh_employes(id),
  contenu        TEXT NOT NULL,
  effectif_reel  INTEGER CHECK (effectif_reel >= 0),
  difficultes    TEXT,
  statut         TEXT NOT NULL DEFAULT 'soumis' CHECK (statut IN ('soumis','lu')),
  lu_par         UUID REFERENCES users(id) ON DELETE SET NULL,
  lu_at          TIMESTAMPTZ,
  commentaire_rh TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((statut = 'lu') = (lu_par IS NOT NULL AND lu_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_formation_rapports_formateur ON formation_rapports_cours(formateur_id);
CREATE INDEX IF NOT EXISTS idx_formation_rapports_statut ON formation_rapports_cours(statut);

-- ------------------------------------------------------------
-- Maintenance : visites
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formation_maintenance_visites (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         TEXT NOT NULL UNIQUE DEFAULT
    ('VISITE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('formation_maintenance_numero_seq')::text, 4, '0')),
  ecole_id       UUID NOT NULL REFERENCES formation_ecoles(id),
  salle_id       UUID REFERENCES formation_salles(id),
  date_visite    DATE NOT NULL DEFAULT CURRENT_DATE,
  technicien_id  UUID REFERENCES rh_employes(id) ON DELETE SET NULL,
  statut         TEXT NOT NULL DEFAULT 'planifiee' CHECK (statut IN ('planifiee','realisee')),
  notes          TEXT,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formation_maintenance_visites_ecole ON formation_maintenance_visites(ecole_id);
CREATE INDEX IF NOT EXISTS idx_formation_maintenance_visites_statut ON formation_maintenance_visites(statut);
CREATE INDEX IF NOT EXISTS idx_formation_maintenance_visites_date ON formation_maintenance_visites(date_visite);

-- ------------------------------------------------------------
-- Maintenance : constats (lignes par visite)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formation_maintenance_constats (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visite_id        UUID NOT NULL REFERENCES formation_maintenance_visites(id) ON DELETE CASCADE,
  equipement_id    UUID NOT NULL REFERENCES formation_equipements(id),
  panne_constatee  TEXT NOT NULL,
  solution         TEXT,
  statut           TEXT NOT NULL DEFAULT 'signale' CHECK (statut IN ('signale','en_cours','resolu')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formation_maintenance_constats_visite ON formation_maintenance_constats(visite_id);
CREATE INDEX IF NOT EXISTS idx_formation_maintenance_constats_equipement ON formation_maintenance_constats(equipement_id);
CREATE INDEX IF NOT EXISTS idx_formation_maintenance_constats_statut ON formation_maintenance_constats(statut);

-- ============================================================
-- HQ Gestion — Module Stocks
-- Catégories, Articles, Mouvements (ledger), Inventaires
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS stocks_mouvements_numero_seq;
CREATE SEQUENCE IF NOT EXISTS stocks_inventaires_numero_seq;

-- ------------------------------------------------------------
-- Catégories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stocks_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Articles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stocks_articles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      TEXT UNIQUE,
  designation    TEXT NOT NULL,
  categorie_id   UUID REFERENCES stocks_categories(id),
  unite          TEXT NOT NULL DEFAULT 'unité',
  quantite_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  seuil_alerte   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (seuil_alerte >= 0),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stocks_articles_categorie ON stocks_articles(categorie_id);
CREATE INDEX IF NOT EXISTS idx_stocks_articles_active ON stocks_articles(is_active);

-- ------------------------------------------------------------
-- Mouvements (ledger unifié entrées/sorties)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stocks_mouvements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         TEXT NOT NULL UNIQUE DEFAULT
    ('MVT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('stocks_mouvements_numero_seq')::text, 4, '0')),
  article_id     UUID NOT NULL REFERENCES stocks_articles(id),
  type           TEXT NOT NULL CHECK (type IN ('entree','sortie')),
  quantite       NUMERIC(12,2) NOT NULL CHECK (quantite > 0),
  quantite_apres NUMERIC(12,2) NOT NULL,
  motif          TEXT NOT NULL,
  source_type    TEXT,
  source_id      UUID,
  effectue_par   UUID REFERENCES users(id) ON DELETE SET NULL,
  observations   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source_id IS NULL OR source_type IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_stocks_mouvements_article ON stocks_mouvements(article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stocks_mouvements_source ON stocks_mouvements(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_stocks_mouvements_type ON stocks_mouvements(type);

-- ------------------------------------------------------------
-- Inventaires
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stocks_inventaires (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE DEFAULT
    ('INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('stocks_inventaires_numero_seq')::text, 4, '0')),
  date_inventaire DATE NOT NULL DEFAULT CURRENT_DATE,
  statut          TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours','cloture')),
  observations    TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  cloture_par     UUID REFERENCES users(id) ON DELETE SET NULL,
  cloture_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stocks_inventaires_statut ON stocks_inventaires(statut);

CREATE TABLE IF NOT EXISTS stocks_inventaires_lignes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventaire_id      UUID NOT NULL REFERENCES stocks_inventaires(id) ON DELETE CASCADE,
  article_id         UUID NOT NULL REFERENCES stocks_articles(id),
  quantite_theorique NUMERIC(12,2) NOT NULL,
  quantite_comptee   NUMERIC(12,2),
  ecart              NUMERIC(12,2) GENERATED ALWAYS AS (quantite_comptee - quantite_theorique) STORED,
  observations       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (inventaire_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_stocks_inv_lignes_inventaire ON stocks_inventaires_lignes(inventaire_id);

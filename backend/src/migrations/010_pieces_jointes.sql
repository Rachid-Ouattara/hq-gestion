-- ============================================================
-- HQ Gestion — Pièces jointes (capacité transverse)
-- Référence polymorphe vers n'importe quelle entité de n'importe
-- quel module — même idiome que `validations`/`stocks_mouvements`.
-- ============================================================

CREATE TABLE IF NOT EXISTS pieces_jointes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code     TEXT NOT NULL REFERENCES modules(code),
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  nom_original    TEXT NOT NULL,
  chemin_stockage TEXT NOT NULL,
  type_mime       TEXT NOT NULL,
  taille_octets   BIGINT NOT NULL CHECK (taille_octets >= 0),
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pieces_jointes_entity ON pieces_jointes(module_code, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pieces_jointes_created ON pieces_jointes(created_at DESC);

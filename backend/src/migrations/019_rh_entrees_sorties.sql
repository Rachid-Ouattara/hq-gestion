CREATE TABLE IF NOT EXISTS rh_checklist_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id UUID NOT NULL REFERENCES rh_employes(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('arrivee','depart')),
  item_key   TEXT NOT NULL,
  label      TEXT NOT NULL,
  ordre      INTEGER NOT NULL DEFAULT 0,
  checked    BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMPTZ,
  checked_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rh_checklist_employe ON rh_checklist_items(employe_id, type);

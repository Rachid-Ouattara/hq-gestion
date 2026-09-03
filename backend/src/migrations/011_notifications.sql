-- ============================================================
-- HQ Gestion — Notifications in-app
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titre        TEXT NOT NULL,
  message      TEXT NOT NULL,
  module_code  TEXT REFERENCES modules(code),
  entity_type  TEXT,
  entity_id    TEXT,
  lu           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_lu ON notifications(user_id, lu);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

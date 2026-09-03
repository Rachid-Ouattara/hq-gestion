ALTER TABLE rh_postes ADD COLUMN IF NOT EXISTS avis_publie BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE rh_entretiens ADD COLUMN IF NOT EXISTS groupe_id UUID;
ALTER TABLE rh_entretiens ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE rh_entretiens ADD COLUMN IF NOT EXISTS meet_link TEXT;
ALTER TABLE rh_entretiens ADD COLUMN IF NOT EXISTS invitation_envoyee_le TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS google_calendar_connexion (
  id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  compte_email   TEXT NOT NULL,
  refresh_token  TEXT NOT NULL,
  connected_by   UUID REFERENCES users(id),
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

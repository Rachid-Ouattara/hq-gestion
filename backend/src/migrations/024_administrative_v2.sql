CREATE TABLE IF NOT EXISTS administrative_agenda_participants (
  agenda_id UUID NOT NULL REFERENCES administrative_agenda(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (agenda_id, user_id)
);

ALTER TABLE administrative_agenda ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE administrative_agenda ADD COLUMN IF NOT EXISTS meet_link TEXT;

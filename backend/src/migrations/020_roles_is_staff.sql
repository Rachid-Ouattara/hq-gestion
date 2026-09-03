ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_staff BOOLEAN NOT NULL DEFAULT false;
UPDATE roles SET is_staff = true WHERE code IN ('admin', 'secretaire', 'direction');

ALTER TABLE prospection_ecoles_cibles ADD COLUMN IF NOT EXISTS date_relance DATE;
CREATE INDEX IF NOT EXISTS idx_prospection_ecoles_cibles_date_relance ON prospection_ecoles_cibles(date_relance);

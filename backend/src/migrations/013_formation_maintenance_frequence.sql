ALTER TABLE formation_salles ADD COLUMN IF NOT EXISTS frequence_maintenance_mois INTEGER CHECK (frequence_maintenance_mois > 0);

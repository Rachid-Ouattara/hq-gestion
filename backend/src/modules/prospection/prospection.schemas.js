import { z } from 'zod';

const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional().nullable());

export const campagneSchema = z.object({
  nom: z.string().trim().min(2),
  annee: z.coerce.number().int().min(2000),
  date_debut: z.string(),
  date_fin: z.string(),
});

export const groupeSchema = z.object({
  campagne_id: z.string().uuid(),
  nom: z.string().trim().min(1),
});

export const membresSchema = z.object({
  employe_ids: z.array(z.string().uuid()),
});

export const ecoleCibleSchema = z.object({
  campagne_id: z.string().uuid(),
  groupe_id: z.string().uuid().optional().nullable(),
  nom: z.string().trim().min(2),
  ville: optionalText,
  contact_nom: optionalText,
  contact_telephone: optionalText,
  contact_email: z.string().trim().email().optional().nullable().or(z.literal('')),
  notes: optionalText,
});

export const rapportSchema = z.object({
  ecole_cible_id: z.string().uuid(),
  date_contact: z.string().optional(),
  resume: z.string().trim().min(2),
  resultat: optionalText,
  prochaine_action: optionalText,
  date_relance: z.string().optional().nullable(),
});

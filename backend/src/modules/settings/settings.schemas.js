import { z } from 'zod';

const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional().nullable());

export const parametresEntrepriseSchema = z.object({
  nom_legal: z.string().trim().min(1).optional(),
  adresse: optionalText,
  telephone: optionalText,
  email: optionalText,
  numero_fiscal: optionalText,
});

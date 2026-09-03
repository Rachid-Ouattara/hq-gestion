import { z } from 'zod';

const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional().nullable());

export const categorieSchema = z.object({
  nom: z.string().trim().min(2),
  description: optionalText,
});

export const articleSchema = z.object({
  reference: optionalText,
  designation: z.string().trim().min(2),
  categorie_id: z.string().uuid().optional().nullable(),
  unite: z.string().trim().min(1).optional(),
  seuil_alerte: z.coerce.number().min(0).optional(),
});

export const mouvementSchema = z.object({
  article_id: z.string().uuid(),
  type: z.enum(['entree', 'sortie']),
  quantite: z.coerce.number().positive(),
  motif: z.string().trim().min(2),
  observations: optionalText,
});

export const inventaireSchema = z.object({
  date_inventaire: z.string().optional(),
  categorie_id: z.string().uuid().optional().nullable(),
  observations: optionalText,
});

export const inventaireLignesSchema = z.object({
  lignes: z.array(z.object({
    id: z.string().uuid(),
    quantite_comptee: z.coerce.number().min(0),
  })).min(1),
});

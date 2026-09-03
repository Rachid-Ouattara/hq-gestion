import { z } from 'zod';

const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional().nullable());

export const compteSchema = z.object({
  code: z.string().trim().min(1),
  libelle: z.string().trim().min(2),
  type: z.enum(['actif', 'passif', 'charge', 'produit', 'capitaux']),
});

export const recetteSchema = z.object({
  compte_id: z.string().uuid(),
  date_recette: z.string().optional(),
  source: z.string().trim().min(2),
  montant: z.coerce.number().positive(),
  reference: optionalText,
});

export const depenseSchema = z.object({
  compte_id: z.string().uuid(),
  budget_id: z.string().uuid().optional().nullable(),
  date_depense: z.string().optional(),
  categorie: z.enum(['loyer', 'electricite', 'eau', 'fournitures', 'salaires', 'transport', 'autre']),
  libelle: z.string().trim().min(2),
  montant: z.coerce.number().positive(),
  reference: optionalText,
});

export const budgetSchema = z.object({
  exercice: z.string().trim().min(4),
  libelle: z.string().trim().min(2),
  departement: optionalText,
  montant_prevu: z.coerce.number().min(0).optional(),
});

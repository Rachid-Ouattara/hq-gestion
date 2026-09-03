import { z } from 'zod';

const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional().nullable());

export const fournisseurSchema = z.object({
  nom: z.string().trim().min(2),
  contact_nom: optionalText,
  telephone: optionalText,
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  adresse: optionalText,
  numero_fiscal: optionalText,
});

const ligneSchema = z.object({
  designation: z.string().trim().min(1),
  quantite: z.coerce.number().positive(),
  unite: optionalText,
});

export const demandeLigneSchema = ligneSchema.extend({
  prix_estime_unitaire: z.coerce.number().min(0).default(0),
});

export const demandeSchema = z.object({
  objet: z.string().trim().min(3),
  justification: optionalText,
  fournisseur_suggere_id: z.string().uuid().optional().nullable(),
  lignes: z.array(demandeLigneSchema).min(1),
});

export const bonLigneSchema = ligneSchema.extend({
  prix_unitaire: z.coerce.number().min(0),
});

export const bonSchema = z.object({
  demande_id: z.string().uuid().optional().nullable(),
  fournisseur_id: z.string().uuid(),
  date_commande: z.string().optional(),
  devise: z.string().trim().min(1).optional(),
  conditions_livraison: optionalText,
  lignes: z.array(bonLigneSchema).min(1),
});

export const receptionLigneSchema = z.object({
  bon_ligne_id: z.string().uuid(),
  quantite_recue: z.coerce.number().positive(),
  etat: z.enum(['conforme', 'endommage', 'manquant']).default('conforme'),
  article_id: z.string().uuid().optional().nullable(),
});

export const receptionSchema = z.object({
  bon_id: z.string().uuid(),
  date_reception: z.string().optional(),
  type: z.enum(['complete', 'partielle']).default('complete'),
  observations: optionalText,
  lignes: z.array(receptionLigneSchema).min(1),
});

export const paiementSchema = z.object({
  bon_id: z.string().uuid(),
  montant: z.coerce.number().positive(),
  date_paiement: z.string().optional(),
  mode: z.enum(['especes', 'virement', 'cheque', 'mobile_money']),
  reference: optionalText,
});

export const decisionSchema = z.object({
  decision: z.enum(['validated', 'rejected']),
  comment: optionalText,
});

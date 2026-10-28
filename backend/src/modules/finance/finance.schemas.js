import { z } from 'zod';

const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional().nullable());

export const ACTIVITES = ['formation', 'vente_materiels', 'logiciels', 'projets_partenariats', 'prestations_diverses', 'autres_produits'];

const optionalActivite = z.preprocess((v) => (v === '' ? undefined : v), z.enum(ACTIVITES).optional().nullable());

export const compteSchema = z.object({
  code: z.string().trim().min(1),
  libelle: z.string().trim().min(2),
  type: z.enum(['actif', 'passif', 'charge', 'produit', 'capitaux']),
  type_tresorerie: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['banque', 'caisse', 'mobile_money']).optional().nullable()),
});

export const recetteSchema = z.object({
  compte_id: z.string().uuid(),
  date_recette: z.string().optional(),
  source: z.string().trim().min(2),
  montant: z.coerce.number().positive(),
  reference: optionalText,
  activite: z.enum(ACTIVITES),
});

export const depenseSchema = z.object({
  compte_id: z.string().uuid(),
  budget_id: z.string().uuid().optional().nullable(),
  date_depense: z.string().optional(),
  categorie: z.enum(['personnel', 'fiscalite_sociale', 'loyers', 'fonctionnement', 'achats', 'communication', 'transport_logistique', 'energie_telecom', 'prestations_externes', 'autre']),
  libelle: z.string().trim().min(2),
  montant: z.coerce.number().positive(),
  reference: optionalText,
  activite: optionalActivite,
});

export const budgetSchema = z.object({
  exercice: z.string().trim().min(4),
  libelle: z.string().trim().min(2),
  departement: optionalText,
  montant_prevu: z.coerce.number().min(0).optional(),
});

export const previsionRecetteSchema = z.object({
  exercice: z.string().trim().min(4),
  mois: z.coerce.number().int().min(1).max(12),
  activite: z.enum(ACTIVITES),
  montant_prevu: z.coerce.number().min(0),
});

export const engagementSchema = z.object({
  libelle: z.string().trim().min(2),
  montant: z.coerce.number().positive(),
  date_engagement: z.string().optional(),
  echeance: optionalText,
  responsable_id: z.string().uuid().optional().nullable(),
  notes: optionalText,
});

export const chargeRecurrenteSchema = z.object({
  libelle: z.string().trim().min(2),
  montant: z.coerce.number().positive(),
  periodicite: z.enum(['mensuelle', 'trimestrielle', 'annuelle']),
  prochaine_echeance: z.string(),
});

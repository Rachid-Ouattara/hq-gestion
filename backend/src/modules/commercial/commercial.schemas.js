import { z } from 'zod';

const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional().nullable());

export const clientSchema = z.object({
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
  prix_unitaire: z.coerce.number().min(0),
});

export const devisSchema = z.object({
  objet: z.string().trim().min(3),
  client_id: z.string().uuid(),
  date_devis: z.string().optional(),
  validite_jours: z.coerce.number().int().positive().default(30),
  lignes: z.array(ligneSchema).min(1),
});

export const commandeSchema = z.object({
  devis_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid(),
  date_commande: z.string().optional(),
  devise: z.string().trim().min(1).optional(),
  conditions_livraison: optionalText,
  lignes: z.array(ligneSchema).min(1),
});

export const factureSchema = z.object({
  commande_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid(),
  date_facture: z.string().optional(),
  echeance: z.string().optional().nullable(),
  lignes: z.array(ligneSchema).min(1),
});

export const encaissementSchema = z.object({
  facture_id: z.string().uuid(),
  compte_id: z.string().uuid().optional().nullable(),
  montant: z.coerce.number().positive(),
  date_encaissement: z.string().optional(),
  mode: z.enum(['especes', 'virement', 'cheque', 'mobile_money']),
  reference: optionalText,
});

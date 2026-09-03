import { z } from 'zod';

const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional().nullable());
const DOMAINES = ['ia', 'informatique', 'robotique', 'drone'];

export const ecoleSchema = z.object({
  nom: z.string().trim().min(2),
  ville: z.string().trim().min(2),
  adresse: optionalText,
  contact_nom: optionalText,
  contact_telephone: optionalText,
  contact_email: z.string().trim().email().optional().nullable().or(z.literal('')),
  date_debut_partenariat: z.string().optional().nullable(),
  notes: optionalText,
});

export const salleSchema = z.object({
  nom: z.string().trim().min(1),
  capacite: z.coerce.number().int().positive().optional().nullable(),
  notes: optionalText,
  frequence_maintenance_mois: z.coerce.number().int().positive().optional().nullable(),
});

export const classeSchema = z.object({
  nom: z.string().trim().min(1),
  notes: optionalText,
});

export const chapitreSchema = z.object({
  classe_id: z.string().uuid(),
  domaine: z.enum(DOMAINES),
  titre: z.string().trim().min(2),
  description: optionalText,
  ordre: z.coerce.number().int().min(0).optional(),
});

export const equipementSchema = z.object({
  salle_id: z.string().uuid(),
  type_equipement: z.enum(['pc', 'kit_robotique', 'drone', 'tv_interactive', 'climatiseur', 'reseau', 'autre']),
  designation: z.string().trim().min(2),
  numero_serie: optionalText,
  date_installation: z.string().optional().nullable(),
  notes: optionalText,
});

export const campSchema = z.object({
  nom: z.string().trim().min(2),
  lieu: z.string().trim().min(2),
  ville: optionalText,
  date_debut: z.string(),
  date_fin: z.string(),
  responsable_nom: optionalText,
  responsable_telephone: optionalText,
  notes: optionalText,
});

export const domainesSchema = z.object({
  domaines: z.array(z.enum(DOMAINES)),
});

export const seanceSchema = z.object({
  date_seance: z.string(),
  heure_debut: z.string(),
  heure_fin: z.string(),
  lieu_type: z.enum(['ecole', 'camp']),
  ecole_id: z.string().uuid().optional().nullable(),
  salle_id: z.string().uuid().optional().nullable(),
  camp_id: z.string().uuid().optional().nullable(),
  domaine: z.enum(DOMAINES),
  formateur_id: z.string().uuid(),
  classe_id: z.string().uuid().optional().nullable(),
  groupe: optionalText,
  effectif_prevu: z.coerce.number().int().min(0).optional().nullable(),
  notes: optionalText,
});

export const rapportCoursSchema = z.object({
  seance_id: z.string().uuid(),
  contenu: z.string().trim().min(2),
  effectif_reel: z.coerce.number().int().min(0).optional().nullable(),
  difficultes: optionalText,
  chapitre_ids: z.array(z.string().uuid()).optional(),
});

export const visiteSchema = z.object({
  ecole_id: z.string().uuid(),
  salle_id: z.string().uuid().optional().nullable(),
  date_visite: z.string().optional(),
  technicien_id: z.string().uuid().optional().nullable(),
  notes: optionalText,
});

export const constatSchema = z.object({
  equipement_id: z.string().uuid(),
  panne_constatee: z.string().trim().min(2),
  solution: optionalText,
});

export { DOMAINES };

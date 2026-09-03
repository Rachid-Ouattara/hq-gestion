import { z } from 'zod';

const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional().nullable());
const optionalUuid = z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional().nullable());

export const employeSchema = z.object({
  matricule: z.string().trim().min(1),
  nom: z.string().trim().min(2),
  prenom: z.string().trim().min(2),
  date_naissance: z.string().optional().nullable(),
  telephone: optionalText,
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  adresse: optionalText,
  poste: z.string().trim().min(2),
  departement: optionalText,
  date_embauche: z.string().optional(),
  type_contrat: z.enum(['cdi', 'cdd', 'stage', 'consultant']),
  salaire_base: z.coerce.number().min(0).optional(),
  responsable_id: z.string().uuid().optional().nullable(),
});

export const congeSchema = z.object({
  employe_id: z.string().uuid(),
  type_conge: z.enum(['annuel', 'maladie', 'maternite', 'paternite', 'sans_solde', 'autre']),
  date_debut: z.string(),
  date_fin: z.string(),
  nombre_jours: z.coerce.number().positive(),
  motif: optionalText,
});

export const decisionSchema = z.object({
  decision: z.enum(['validated', 'rejected']),
  comment: optionalText,
});

export const paieSchema = z.object({
  employe_id: z.string().uuid(),
  periode: z.string().trim().regex(/^\d{4}-\d{2}$/, "Format attendu : AAAA-MM"),
  salaire_base: z.coerce.number().min(0).optional(),
  primes: z.coerce.number().min(0).optional(),
  deductions: z.coerce.number().min(0).optional(),
});

export const evaluationSchema = z.object({
  employe_id: z.string().uuid(),
  evaluateur_id: optionalUuid,
  periode: z.string().trim().min(1),
  score: z.coerce.number().min(0).max(20).optional().nullable(),
  points_forts: optionalText,
  axes_amelioration: optionalText,
  commentaires: optionalText,
});

export const formationSchema = z.object({
  titre: z.string().trim().min(2),
  organisme: optionalText,
  lieu: optionalText,
  date_debut: z.string(),
  date_fin: z.string(),
  cout: z.coerce.number().min(0).optional(),
});

export const participantSchema = z.object({
  employe_id: z.string().uuid(),
});

export const rapportActiviteSchema = z.object({
  employe_id: z.string().uuid().optional(),
  periode_debut: z.string(),
  periode_fin: z.string(),
  contenu: z.string().trim().min(2),
  difficultes: optionalText,
});

export const commentaireResponsableSchema = z.object({
  commentaire_responsable: optionalText,
});

export const posteSchema = z.object({
  titre: z.string().trim().min(2),
  departement: optionalText,
  type_contrat: z.enum(['cdi', 'cdd', 'stage', 'consultant']),
  description: optionalText,
  nombre_postes: z.coerce.number().int().min(1).optional(),
});

export const candidatSchema = z.object({
  poste_id: z.string().uuid(),
  nom: z.string().trim().min(2),
  prenom: z.string().trim().min(2),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  telephone: optionalText,
  source: optionalText,
  notes: optionalText,
});

export const entretienSchema = z.object({
  evaluateur_id: optionalUuid,
  date_entretien: z.string(),
  heure_debut: z.string().optional().nullable(),
  heure_fin: z.string().optional().nullable(),
  mode: z.enum(['presentiel', 'visio']).optional(),
  score: z.coerce.number().min(0).max(20).optional().nullable(),
  commentaire: optionalText,
});

export const embaucherSchema = z.object({
  matricule: z.string().trim().min(1),
  date_embauche: z.string().optional(),
  salaire_base: z.coerce.number().min(0).optional(),
});

export const contratSchema = z.object({
  type_contrat: z.enum(['cdi', 'cdd', 'stage', 'consultant']),
  poste: optionalText,
  date_debut: z.string(),
  date_fin: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
  salaire_base: z.coerce.number().min(0).optional(),
  notes: optionalText,
});

export const parametresPointageSchema = z.object({
  heure_arrivee_attendue: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format attendu : HH:MM').optional(),
  tolerance_minutes: z.coerce.number().int().min(0).optional(),
});

export const ipAutoriseeSchema = z.object({
  label: z.string().trim().min(1),
  ip_ou_cidr: z.string().trim().min(3),
});

export const pointageManuelSchema = z.object({
  employe_id: z.string().uuid(),
  date_jour: z.string(),
  heure_arrivee: optionalText,
  heure_depart: optionalText,
  notes: optionalText,
});

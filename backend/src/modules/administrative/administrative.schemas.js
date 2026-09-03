import { z } from 'zod';

const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional().nullable());

export const archiveSchema = z.object({
  code: z.string().trim().min(2),
  libelle: z.string().trim().min(2),
  type_support: z.enum(['physique', 'numerique']).optional(),
  emplacement: optionalText,
  responsable_id: z.string().uuid().optional().nullable(),
  observations: optionalText,
});

export const courrierSchema = z.object({
  sens: z.enum(['entrant', 'sortant']),
  objet: z.string().trim().min(2),
  correspondant: z.string().trim().min(2),
  date_courrier: z.string().optional(),
  mode_transmission: optionalText,
  observations: optionalText,
});

export const documentSchema = z.object({
  type_document: z.enum(['contrat', 'certificat', 'proces_verbal', 'attestation', 'autre']),
  titre: z.string().trim().min(2),
  description: optionalText,
  date_document: z.string().optional(),
  date_expiration: z.string().optional().nullable(),
});

export const agendaSchema = z.object({
  titre: z.string().trim().min(2),
  description: optionalText,
  date_debut: z.string(),
  date_fin: z.string(),
  lieu: optionalText,
  participants: optionalText,
});

export const noteSchema = z.object({
  objet: z.string().trim().min(2),
  contenu: z.string().trim().min(2),
  destinataires: optionalText,
  date_note: z.string().optional(),
});

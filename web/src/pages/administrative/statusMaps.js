export const ARCHIVE_STATUT = {
  ouvert: { label: 'Ouvert', className: 'bg-hq-blue-light text-hq-blue' },
  clos: { label: 'Clos', className: 'bg-slate-100 text-slate-500' },
};

export const COURRIER_STATUT = {
  nouveau: { label: 'Nouveau', className: 'bg-hq-blue-light text-hq-blue' },
  en_traitement: { label: 'En traitement', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  traite: { label: 'Traité', className: 'bg-emerald-50 text-emerald-700' },
  archive: { label: 'Archivé', className: 'bg-slate-100 text-slate-500' },
};

export const DOCUMENT_STATUT = {
  actif: { label: 'Actif', className: 'bg-emerald-50 text-emerald-700' },
  expire: { label: 'Expiré', className: 'bg-red-50 text-red-600' },
  archive: { label: 'Archivé', className: 'bg-slate-100 text-slate-500' },
};

export const DOCUMENT_TYPE_LABEL = {
  contrat: 'Contrat',
  certificat: 'Certificat',
  proces_verbal: 'Procès-verbal',
  attestation: 'Attestation',
  autre: 'Autre',
};

export const AGENDA_STATUT = {
  planifie: { label: 'Planifié', className: 'bg-hq-blue-light text-hq-blue' },
  termine: { label: 'Terminé', className: 'bg-emerald-50 text-emerald-700' },
  annule: { label: 'Annulé', className: 'bg-red-50 text-red-600' },
};

export const NOTE_STATUT = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-500' },
  diffusee: { label: 'Diffusée', className: 'bg-emerald-50 text-emerald-700' },
};

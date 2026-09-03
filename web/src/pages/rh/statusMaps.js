export const EMPLOYE_STATUT = {
  actif: { label: 'Actif', className: 'bg-emerald-50 text-emerald-700' },
  conge: { label: 'En congé', className: 'bg-hq-blue-light text-hq-blue' },
  suspendu: { label: 'Suspendu', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  termine: { label: 'Terminé', className: 'bg-slate-100 text-slate-500' },
};

export const TYPE_CONTRAT_LABEL = {
  cdi: 'CDI',
  cdd: 'CDD',
  stage: 'Stage',
  consultant: 'Consultant',
};

export const CONGE_STATUT = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-500' },
  soumise: { label: 'Soumise', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  validee: { label: 'Validée', className: 'bg-emerald-50 text-emerald-700' },
  rejetee: { label: 'Rejetée', className: 'bg-red-50 text-red-600' },
};

export const TYPE_CONGE_LABEL = {
  annuel: 'Congé annuel',
  maladie: 'Maladie',
  maternite: 'Maternité',
  paternite: 'Paternité',
  sans_solde: 'Sans solde',
  autre: 'Autre',
};

export const PAIE_STATUT = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-500' },
  payee: { label: 'Payée', className: 'bg-emerald-50 text-emerald-700' },
};

export const EVALUATION_STATUT = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-500' },
  finalisee: { label: 'Finalisée', className: 'bg-emerald-50 text-emerald-700' },
};

export const FORMATION_STATUT = {
  planifiee: { label: 'Planifiée', className: 'bg-hq-blue-light text-hq-blue' },
  en_cours: { label: 'En cours', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  terminee: { label: 'Terminée', className: 'bg-emerald-50 text-emerald-700' },
  annulee: { label: 'Annulée', className: 'bg-red-50 text-red-600' },
};

export const CONTRAT_STATUT = {
  actif: { label: 'Actif', className: 'bg-emerald-50 text-emerald-700' },
  expire: { label: 'Expiré', className: 'bg-red-50 text-red-600' },
  resilie: { label: 'Résilié', className: 'bg-slate-100 text-slate-500' },
  renouvele: { label: 'Renouvelé', className: 'bg-hq-blue-light text-hq-blue' },
};

export const RAPPORT_ACTIVITE_STATUT = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-500' },
  soumis: { label: 'Soumis', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  valide: { label: 'Validé', className: 'bg-emerald-50 text-emerald-700' },
  rejete: { label: 'Rejeté', className: 'bg-red-50 text-red-600' },
};

export const POSTE_STATUT = {
  ouvert: { label: 'Ouvert', className: 'bg-hq-blue-light text-hq-blue' },
  pourvu: { label: 'Pourvu', className: 'bg-emerald-50 text-emerald-700' },
  annule: { label: 'Annulé', className: 'bg-slate-100 text-slate-500' },
};

export const CANDIDAT_STATUT = {
  recu: { label: 'Reçu', className: 'bg-slate-100 text-slate-500' },
  preselection: { label: 'Présélection', className: 'bg-hq-blue-light text-hq-blue' },
  entretien: { label: 'Entretien', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  offre: { label: 'Offre', className: 'bg-purple-50 text-purple-700' },
  embauche: { label: 'Embauché', className: 'bg-emerald-50 text-emerald-700' },
  refuse: { label: 'Refusé', className: 'bg-red-50 text-red-600' },
};

export const ENTRETIEN_STATUT = {
  planifie: { label: 'Planifié', className: 'bg-hq-blue-light text-hq-blue' },
  realise: { label: 'Réalisé', className: 'bg-emerald-50 text-emerald-700' },
  annule: { label: 'Annulé', className: 'bg-red-50 text-red-600' },
};

export const POINTAGE_STATUT = {
  present: { label: 'À l\'heure', className: 'bg-emerald-50 text-emerald-700' },
  retard: { label: 'Retard', className: 'bg-hq-orange/15 text-hq-orange-dark' },
};

export const POINTAGE_SOURCE_LABEL = {
  logiciel: 'Badgeuse logicielle',
  manuel: 'Correction manuelle',
  appareil: 'Pointeuse biométrique',
};

export const PARTICIPATION_STATUT = {
  inscrit: { label: 'Inscrit', className: 'bg-hq-blue-light text-hq-blue' },
  present: { label: 'Présent', className: 'bg-emerald-50 text-emerald-700' },
  absent: { label: 'Absent', className: 'bg-red-50 text-red-600' },
  certifie: { label: 'Certifié', className: 'bg-hq-orange/15 text-hq-orange-dark' },
};

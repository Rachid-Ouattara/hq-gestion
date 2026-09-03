export const ECOLE_STATUT = {
  actif: { label: 'Actif', className: 'bg-emerald-50 text-emerald-700' },
  suspendu: { label: 'Suspendu', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  termine: { label: 'Terminé', className: 'bg-slate-100 text-slate-500' },
};

export const CAMP_STATUT = {
  planifie: { label: 'Planifié', className: 'bg-hq-blue-light text-hq-blue' },
  en_cours: { label: 'En cours', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  termine: { label: 'Terminé', className: 'bg-emerald-50 text-emerald-700' },
  annule: { label: 'Annulé', className: 'bg-red-50 text-red-600' },
};

export const EQUIPEMENT_ETAT = {
  fonctionnel: { label: 'Fonctionnel', className: 'bg-emerald-50 text-emerald-700' },
  en_panne: { label: 'En panne', className: 'bg-red-50 text-red-600' },
  en_reparation: { label: 'En réparation', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  hors_service: { label: 'Hors service', className: 'bg-slate-100 text-slate-500' },
};

export const EQUIPEMENT_TYPE_LABEL = {
  pc: 'Ordinateur',
  kit_robotique: 'Kit robotique',
  drone: 'Drone',
  tv_interactive: 'TV interactive',
  climatiseur: 'Climatiseur',
  reseau: 'Réseau',
  autre: 'Autre',
};

export const DOMAINE_LABEL = {
  ia: 'Intelligence Artificielle',
  informatique: 'Informatique',
  robotique: 'Robotique',
  drone: 'Pilotage de drone',
};

export const SEANCE_STATUT = {
  planifiee: { label: 'Planifiée', className: 'bg-hq-blue-light text-hq-blue' },
  realisee: { label: 'Réalisée', className: 'bg-emerald-50 text-emerald-700' },
  annulee: { label: 'Annulée', className: 'bg-red-50 text-red-600' },
};

export const RAPPORT_STATUT = {
  soumis: { label: 'Soumis', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  lu: { label: 'Lu', className: 'bg-emerald-50 text-emerald-700' },
};

export const VISITE_STATUT = {
  planifiee: { label: 'Planifiée', className: 'bg-hq-blue-light text-hq-blue' },
  realisee: { label: 'Réalisée', className: 'bg-emerald-50 text-emerald-700' },
};

export const CONSTAT_STATUT = {
  signale: { label: 'Signalé', className: 'bg-red-50 text-red-600' },
  en_cours: { label: 'En cours', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  resolu: { label: 'Résolu', className: 'bg-emerald-50 text-emerald-700' },
};

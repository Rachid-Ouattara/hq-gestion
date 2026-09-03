export const DEMANDE_STATUS = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-500' },
  soumise: { label: 'Soumise', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  validee: { label: 'Validée', className: 'bg-emerald-50 text-emerald-700' },
  rejetee: { label: 'Rejetée', className: 'bg-red-50 text-red-600' },
};

export const BON_STATUS = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-500' },
  envoyee: { label: 'Envoyée', className: 'bg-hq-blue-light text-hq-blue' },
  receptionnee_partielle: { label: 'Réception partielle', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  receptionnee_complete: { label: 'Réceptionnée', className: 'bg-emerald-50 text-emerald-700' },
  annule: { label: 'Annulé', className: 'bg-red-50 text-red-600' },
};

export const RECEPTION_ETAT = {
  conforme: { label: 'Conforme', className: 'bg-emerald-50 text-emerald-700' },
  endommage: { label: 'Endommagé', className: 'bg-red-50 text-red-600' },
  manquant: { label: 'Manquant', className: 'bg-hq-orange/15 text-hq-orange-dark' },
};

export const PAIEMENT_MODE_LABEL = {
  especes: 'Espèces',
  virement: 'Virement',
  cheque: 'Chèque',
  mobile_money: 'Mobile Money',
};

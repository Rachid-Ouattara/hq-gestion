export const DEVIS_STATUS = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-500' },
  envoye: { label: 'Envoyé', className: 'bg-hq-blue-light text-hq-blue' },
  accepte: { label: 'Accepté', className: 'bg-emerald-50 text-emerald-700' },
  refuse: { label: 'Refusé', className: 'bg-red-50 text-red-600' },
  expire: { label: 'Expiré', className: 'bg-slate-100 text-slate-500' },
};

export const COMMANDE_STATUS = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-500' },
  confirmee: { label: 'Confirmée', className: 'bg-hq-blue-light text-hq-blue' },
  livree: { label: 'Livrée', className: 'bg-emerald-50 text-emerald-700' },
  facturee: { label: 'Facturée', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  annulee: { label: 'Annulée', className: 'bg-red-50 text-red-600' },
};

export const FACTURE_STATUS = {
  emise: { label: 'Émise', className: 'bg-hq-blue-light text-hq-blue' },
  partiellement_payee: { label: 'Partiellement payée', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  payee: { label: 'Payée', className: 'bg-emerald-50 text-emerald-700' },
  annulee: { label: 'Annulée', className: 'bg-red-50 text-red-600' },
};

export const ENCAISSEMENT_MODE_LABEL = {
  especes: 'Espèces',
  virement: 'Virement',
  cheque: 'Chèque',
  mobile_money: 'Mobile Money',
};

export const INVENTAIRE_STATUT = {
  en_cours: { label: 'En cours', className: 'bg-hq-blue-light text-hq-blue' },
  cloture: { label: 'Clôturé', className: 'bg-emerald-50 text-emerald-700' },
};

export const MOUVEMENT_TYPE = {
  entree: { label: 'Entrée', className: 'bg-emerald-50 text-emerald-700' },
  sortie: { label: 'Sortie', className: 'bg-hq-orange/15 text-hq-orange-dark' },
};

export const STOCK_ETAT = {
  ok: { label: 'OK', className: 'bg-emerald-50 text-emerald-700' },
  alerte: { label: 'Sous le seuil', className: 'bg-red-50 text-red-600' },
};

export const MOUVEMENT_MOTIF_LABEL = {
  reception_achat: 'Réception fournisseur',
  ajustement_inventaire: 'Ajustement d\'inventaire',
};

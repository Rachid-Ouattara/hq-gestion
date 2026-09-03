/**
 * Registre des modules métier de HQ Gestion.
 * Les couleurs reprennent le code visuel de l'organigramme pour garder
 * la continuité entre le schéma et l'application.
 * `features` = feuille de route (sous-modules) affichée dans la navigation.
 */
export const MODULES = [
  {
    code: 'administrative',
    name: 'Gestion Administrative',
    color: '#2456a6',
    icon: 'folder',
    sort_order: 1,
    features: [
      'Courrier (Entrée/Sortie)',
      'Classement & Archivage',
      'Documents administratifs',
      'Agenda & Rendez-vous',
      'Notes & Mémos',
    ],
  },
  {
    code: 'rh',
    name: 'Ressources Humaines',
    color: '#4a9d5b',
    icon: 'users',
    sort_order: 2,
    features: [
      'Dossier du personnel',
      'Gestion des congés & absences',
      'Paie & Rémunérations',
      'Évaluations',
      'Formation',
    ],
  },
  {
    code: 'achats',
    name: 'Gestion des Achats',
    color: '#7b4b9e',
    icon: 'cart',
    sort_order: 3,
    features: [
      "Demandes d'achat",
      'Fournisseurs',
      'Bons de commande',
      'Réception des biens & services',
      'Suivi des paiements',
    ],
  },
  {
    code: 'stocks',
    name: 'Gestion des Stocks',
    color: '#e8823a',
    icon: 'box',
    sort_order: 4,
    features: [
      'Articles & Catégories',
      'Entrées en stock',
      'Sorties en stock',
      'Inventaires',
      'Alertes de réapprovisionnement',
    ],
  },
  {
    code: 'finance',
    name: 'Gestion Financière',
    color: '#2a9d8f',
    icon: 'calculator',
    sort_order: 5,
    features: [
      'Comptabilité générale',
      'Recettes',
      'Dépenses',
      'Budgets',
      'États financiers & Rapports',
    ],
  },
  {
    code: 'commercial',
    name: 'Gestion Commerciale',
    color: '#3a7bd5',
    icon: 'trending-up',
    sort_order: 6,
    features: [
      'Clients',
      'Devis',
      'Commandes',
      'Facturation',
      'Suivi des encaissements',
    ],
  },
  {
    code: 'reporting',
    name: 'Tableaux de bord & Reporting',
    color: '#5ca95c',
    icon: 'pie-chart',
    sort_order: 7,
    features: [
      'Indicateurs clés (KPI)',
      'Graphiques & Analyses',
      'Rapports personnalisés',
      'Export des données',
      'Suivi des activités',
    ],
  },
  {
    code: 'formation',
    name: 'Formation & Écoles Partenaires',
    color: '#d1495b',
    icon: 'graduation-cap',
    sort_order: 8,
    features: [
      'Écoles partenaires',
      'Camps de vacances',
      'Formateurs & Planning',
      'Rapports de cours',
      'Maintenance',
    ],
  },
  {
    code: 'prospection',
    name: 'Prospection & Écoles Cibles',
    color: '#b8860b',
    icon: 'target',
    sort_order: 9,
    features: [
      'Campagnes de prospection',
      'Groupes & équipes terrain',
      'Écoles ciblées',
      'Rapports de visite',
    ],
  },
];

export const MODULE_CODES = MODULES.map((m) => m.code);

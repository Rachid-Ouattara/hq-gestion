/**
 * Miroir serveur de `ROUTE_MAP` (`web/src/components/NotificationBell.jsx`) — utilisé
 * pour construire l'URL de la charge utile push et le lien du bouton dans l'e-mail.
 * Les deux tables sont tenues à jour ensemble à chaque nouveau type de notification.
 */
const ROUTE_MAP = {
  'formation:rapport_cours': () => '/modules/rapports/cours',
  'formation:seance': () => '/modules/formation/seances',
  'rh:conge': (id) => `/modules/rh/conges/${id}`,
  'achats:demande_achat': (id) => `/modules/achats/demandes/${id}`,
  'stocks:article': () => '/modules/stocks/alertes',
  'rh:candidat': (id) => `/modules/rh/candidats/${id}`,
  'rh:pointage': () => '/modules/rh/presences',
  'rh:contrat': (id) => `/modules/rh/employes/${id}`,
  'rh:entretien': (id) => `/modules/rh/candidats/${id}`,
  'rh:employe': (id) => `/modules/rh/employes/${id}`,
  'administrative:courrier': (id) => `/modules/administrative/courrier/${id}`,
  'administrative:document': (id) => `/modules/administrative/documents/${id}`,
  'administrative:archive': (id) => `/modules/administrative/archives/${id}`,
  'administrative:note': (id) => `/modules/administrative/notes/${id}`,
  'administrative:agenda': () => '/modules/administrative/agenda',
  'finance:facture': (id) => `/modules/commercial/factures/${id}`,
  'finance:bon_commande': (id) => `/modules/achats/bons/${id}`,
};

export function resolveNotificationUrl({ moduleCode, entityType, entityId }) {
  const routeFn = ROUTE_MAP[`${moduleCode}:${entityType}`];
  return routeFn ? routeFn(entityId) : '/';
}

import { ClipboardList, Truck, Wallet, Building2 } from 'lucide-react';
import ModuleOverview from '../../components/ModuleOverview.jsx';

const METRICS = [
  { key: 'demandes_en_attente', label: "Demandes en attente", Icon: ClipboardList, format: 'count' },
  { key: 'bons_en_cours', label: 'Bons en cours', Icon: Truck, format: 'count' },
  { key: 'montant_commande_mois', label: 'Commandé ce mois', Icon: Wallet, format: 'currency' },
  { key: 'fournisseurs_actifs', label: 'Fournisseurs actifs', Icon: Building2, format: 'count' },
];

export default function AchatsApercu() {
  return <ModuleOverview moduleCode="achats" metrics={METRICS} />;
}

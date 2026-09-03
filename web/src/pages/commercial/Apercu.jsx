import { FileText, Truck, AlertTriangle, Wallet } from 'lucide-react';
import ModuleOverview from '../../components/ModuleOverview.jsx';

const METRICS = [
  { key: 'devis_en_attente', label: 'Devis en attente', Icon: FileText, format: 'count' },
  { key: 'commandes_en_cours', label: 'Commandes en cours', Icon: Truck, format: 'count' },
  { key: 'factures_impayees', label: 'Factures impayées', Icon: AlertTriangle, format: 'count' },
  { key: 'encaisse_mois', label: 'Encaissé ce mois', Icon: Wallet, format: 'currency' },
];

export default function CommercialApercu() {
  return <ModuleOverview moduleCode="commercial" metrics={METRICS} />;
}

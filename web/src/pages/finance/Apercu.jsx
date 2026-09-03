import { PiggyBank, Receipt, TrendingUp, FileText } from 'lucide-react';
import ModuleOverview from '../../components/ModuleOverview.jsx';

const METRICS = [
  { key: 'solde_total', label: 'Solde total (comptes actifs)', Icon: PiggyBank, format: 'currency' },
  { key: 'depenses_mois', label: 'Dépenses ce mois', Icon: Receipt, format: 'currency' },
  { key: 'recettes_mois', label: 'Recettes ce mois', Icon: TrendingUp, format: 'currency' },
  { key: 'budgets_actifs', label: 'Budgets actifs', Icon: FileText, format: 'count' },
];

export default function FinanceApercu() {
  return <ModuleOverview moduleCode="finance" metrics={METRICS} />;
}

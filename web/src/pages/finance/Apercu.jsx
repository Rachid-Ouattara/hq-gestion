import { PiggyBank, Receipt, TrendingUp, FileText, Landmark, HandCoins, Scale } from 'lucide-react';
import ModuleOverview from '../../components/ModuleOverview.jsx';

const METRICS = [
  { key: 'solde_total', label: 'Solde total (comptes actifs)', Icon: PiggyBank, format: 'currency' },
  { key: 'depenses_mois', label: 'Dépenses ce mois', Icon: Receipt, format: 'currency' },
  { key: 'recettes_mois', label: 'Recettes ce mois', Icon: TrendingUp, format: 'currency' },
  { key: 'resultat_mois', label: 'Résultat ce mois', Icon: Scale, format: 'currency' },
  { key: 'budgets_actifs', label: 'Budgets actifs', Icon: FileText, format: 'count' },
  { key: 'creances_a_recouvrer', label: 'Créances à recouvrer', Icon: Landmark, format: 'currency' },
  { key: 'dettes_a_payer', label: 'Dettes à payer', Icon: HandCoins, format: 'currency' },
];

export default function FinanceApercu() {
  return <ModuleOverview moduleCode="finance" metrics={METRICS} />;
}

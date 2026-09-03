import { Target, Clock, Handshake, FileText } from 'lucide-react';
import ModuleOverview from '../../components/ModuleOverview.jsx';
import Funnel from './Funnel.jsx';

const METRICS = [
  { key: 'campagnes_actives', label: 'Campagnes actives', Icon: Target, format: 'count' },
  { key: 'relances_en_retard', label: 'Relances en retard', Icon: Clock, format: 'count' },
  { key: 'ecoles_converties', label: 'Écoles converties', Icon: Handshake, format: 'count' },
  { key: 'rapports_mois', label: 'Rapports de visite ce mois', Icon: FileText, format: 'count' },
];

export default function ProspectionApercu() {
  return (
    <div>
      <ModuleOverview moduleCode="prospection" metrics={METRICS} />
      <Funnel />
    </div>
  );
}

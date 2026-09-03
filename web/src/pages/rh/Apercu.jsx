import { UserCheck, Clock, ClipboardList, Wallet, FileClock, UserSearch } from 'lucide-react';
import ModuleOverview from '../../components/ModuleOverview.jsx';
import ATraiter from './ATraiter.jsx';

const METRICS = [
  { key: 'employes_actifs', label: 'Employés actifs', Icon: UserCheck, format: 'count' },
  { key: 'conges_en_attente', label: 'Congés en attente', Icon: Clock, format: 'count' },
  { key: 'evaluations_brouillon', label: 'Évaluations en brouillon', Icon: ClipboardList, format: 'count' },
  { key: 'paies_a_traiter', label: 'Paies à traiter', Icon: Wallet, format: 'count' },
  { key: 'contrats_a_renouveler', label: 'Contrats à échéance', Icon: FileClock, format: 'count' },
  { key: 'candidats_en_cours', label: 'Candidats en cours', Icon: UserSearch, format: 'count' },
];

export default function RhApercu() {
  return (
    <div>
      <ModuleOverview moduleCode="rh" metrics={METRICS} />
      <ATraiter />
    </div>
  );
}

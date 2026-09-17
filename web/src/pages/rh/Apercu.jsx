import { UserCheck, Clock, ClipboardList, Wallet, FileClock, UserSearch } from 'lucide-react';
import ModuleOverview from '../../components/ModuleOverview.jsx';
import ATraiter from './ATraiter.jsx';
import { useAuth } from '../../lib/auth.jsx';

const ALL_METRICS = [
  { key: 'employes_actifs', label: 'Employés actifs', Icon: UserCheck, format: 'count' },
  { key: 'conges_en_attente', label: 'Congés en attente', Icon: Clock, format: 'count' },
  { key: 'evaluations_brouillon', label: 'Évaluations en brouillon', Icon: ClipboardList, format: 'count' },
  { key: 'paies_a_traiter', label: 'Paies à traiter', Icon: Wallet, format: 'count', requires: 'rh_paie' },
  { key: 'contrats_a_renouveler', label: 'Contrats à échéance', Icon: FileClock, format: 'count' },
  { key: 'candidats_en_cours', label: 'Candidats en cours', Icon: UserSearch, format: 'count' },
];

export default function RhApercu() {
  const { can } = useAuth();
  const metrics = ALL_METRICS.filter((m) => !m.requires || can(m.requires, 'read'));

  return (
    <div>
      <ModuleOverview moduleCode="rh" metrics={metrics} />
      <ATraiter />
    </div>
  );
}

import { Navigate } from 'react-router-dom';
import { CalendarDays, ClipboardList, Wrench, GraduationCap } from 'lucide-react';
import { useAuth } from '../../lib/auth.jsx';
import ModuleOverview from '../../components/ModuleOverview.jsx';
import Echeancier from './Echeancier.jsx';

const METRICS = [
  { key: 'seances_a_venir', label: 'Séances à venir', Icon: CalendarDays, format: 'count' },
  { key: 'rapports_a_lire', label: 'Rapports à lire', Icon: ClipboardList, format: 'count' },
  { key: 'salles_maintenance_en_retard', label: 'Salles à entretenir', Icon: Wrench, format: 'count' },
  { key: 'ecoles_actives', label: 'Écoles partenaires actives', Icon: GraduationCap, format: 'count' },
];

export default function FormationApercu() {
  const { user } = useAuth();
  if (user?.role === 'formateur') return <Navigate to="seances" replace />;
  return (
    <div>
      <ModuleOverview moduleCode="formation" metrics={METRICS} />
      <Echeancier />
    </div>
  );
}

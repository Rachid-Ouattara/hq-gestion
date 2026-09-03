import { Mail, CalendarDays, Archive, FileText } from 'lucide-react';
import ModuleOverview from '../../components/ModuleOverview.jsx';

const METRICS = [
  { key: 'courriers_a_traiter', label: 'Courriers à traiter', Icon: Mail, format: 'count' },
  { key: 'rendez_vous_a_venir', label: 'Rendez-vous à venir', Icon: CalendarDays, format: 'count' },
  { key: 'dossiers_ouverts', label: "Dossiers d'archive ouverts", Icon: Archive, format: 'count' },
  { key: 'documents_actifs', label: 'Documents actifs', Icon: FileText, format: 'count' },
];

export default function AdministrativeApercu() {
  return <ModuleOverview moduleCode="administrative" metrics={METRICS} />;
}

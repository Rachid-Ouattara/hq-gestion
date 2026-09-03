import { AlertTriangle, Repeat, Boxes, CheckSquare } from 'lucide-react';
import ModuleOverview from '../../components/ModuleOverview.jsx';

const METRICS = [
  { key: 'articles_sous_seuil', label: 'Articles sous le seuil', Icon: AlertTriangle, format: 'count' },
  { key: 'mouvements_30j', label: 'Mouvements (30j)', Icon: Repeat, format: 'count' },
  { key: 'inventaires_en_cours', label: 'Inventaires en cours', Icon: Boxes, format: 'count' },
  { key: 'articles_actifs', label: 'Articles actifs', Icon: CheckSquare, format: 'count' },
];

export default function StocksApercu() {
  return <ModuleOverview moduleCode="stocks" metrics={METRICS} />;
}

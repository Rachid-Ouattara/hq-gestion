import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, CheckCircle2, Activity } from 'lucide-react';
import { get } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { moduleIcon } from '../lib/moduleIcons.js';
import StatCard from '../components/StatCard.jsx';
import PointageWidget from '../components/PointageWidget.jsx';

const KPI_META = [
  { key: 'utilisateurs_actifs', label: 'Utilisateurs actifs', Icon: Users },
  { key: 'validations_en_attente', label: 'Validations en attente', Icon: Clock },
  { key: 'validations_traitees', label: 'Validations traitées', Icon: CheckCircle2 },
  { key: 'actions_7j', label: 'Actions (7 jours)', Icon: Activity },
];

export default function Dashboard() {
  const { user, can } = useAuth();
  const [kpi, setKpi] = useState(null);
  const [modules, setModules] = useState([]);

  useEffect(() => {
    get('/modules').then(setModules).catch(() => {});
    if (can('reporting', 'read')) {
      get('/reporting/kpi').then(setKpi).catch(() => {});
    }
  }, [can]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-hq-blue">Bonjour, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500">Vue d'ensemble de l'activité</p>
      </header>

      <PointageWidget />

      {kpi && (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KPI_META.map(({ key, label, Icon }) => (
            <StatCard key={key} label={label} value={kpi[key]} Icon={Icon} accent={key === 'validations_en_attente'} />
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Modules</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {modules.map((m) => {
          const Icon = moduleIcon(m.icon);
          return (
            <Link key={m.code} to={`/modules/${m.code}`} className="card p-4 transition hover:shadow-md">
              <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg" style={{ backgroundColor: m.color }}>
                <Icon size={20} className="text-white" />
              </span>
              <p className="text-sm font-medium leading-tight text-slate-800">{m.name}</p>
              <p className="mt-1 text-xs text-slate-400">{m.features.length} fonctionnalités</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

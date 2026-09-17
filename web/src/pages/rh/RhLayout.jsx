import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { get } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { moduleIcon } from '../../lib/moduleIcons.js';

const STAFF_TABS = [
  { to: '.', label: 'Aperçu', end: true },
  { to: 'employes', label: 'Dossier du personnel' },
  { to: 'conges', label: 'Congés & absences' },
  { to: 'paies', label: 'Paie & Rémunérations', requires: 'rh_paie' },
  { to: 'evaluations', label: 'Évaluations' },
  { to: 'formations', label: 'Formation' },
  { to: 'recrutement', label: 'Recrutement' },
  { to: 'presences', label: 'Présences' },
];

const SELF_TABS = [
  { to: 'mon-dossier', label: 'Mon dossier' },
  { to: 'conges', label: 'Mes congés' },
  { to: 'mes-courriers', label: 'Mes courriers' },
  { to: 'rapports-activite', label: "Mes rapports d'activité" },
];

const tabClass = ({ isActive }) =>
  `whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
    isActive ? 'border-hq-orange text-hq-blue' : 'border-transparent text-slate-500 hover:text-slate-700'
  }`;

export default function RhLayout() {
  const { user, can } = useAuth();
  const location = useLocation();
  const [module, setModule] = useState(null);

  useEffect(() => {
    get('/modules/rh').then(setModule).catch(() => {});
  }, []);

  const Icon = moduleIcon(module?.icon);
  const isSelfService = ['formateur', 'employe'].includes(user?.role);
  const tabs = (isSelfService ? SELF_TABS : STAFF_TABS).filter((t) => !t.requires || can(t.requires, 'read'));

  return (
    <div>
      <header className="mb-6 flex items-center gap-4">
        <span
          className="grid h-12 w-12 place-items-center rounded-xl"
          style={{ backgroundColor: module?.color || '#4a9d5b' }}
        >
          <Icon size={24} className="text-white" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-hq-blue">
            {isSelfService ? 'Mon dossier' : 'Ressources Humaines'}
          </h1>
          <p className="text-sm text-slate-500">
            {isSelfService ? 'Vos informations, congés, courrier et rapports' : 'Personnel, congés, paie, évaluations et formation'}
          </p>
        </div>
      </header>

      <nav className="mb-6 flex gap-6 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}>
            {t.label}
          </NavLink>
        ))}
      </nav>

      {isSelfService && location.pathname.replace(/\/+$/, '').endsWith('/rh') ? (
        <Navigate to="mon-dossier" replace />
      ) : (
        <Outlet />
      )}
    </div>
  );
}

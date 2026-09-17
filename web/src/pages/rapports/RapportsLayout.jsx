import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { get } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { moduleIcon } from '../../lib/moduleIcons.js';

const TABS = [
  { to: 'cours', label: 'Cours', requires: 'formation' },
  { to: 'activite', label: 'Activité', requires: 'rh' },
  { to: 'visite', label: 'Visite', requires: 'prospection' },
];

const tabClass = ({ isActive }) =>
  `whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
    isActive ? 'border-hq-orange text-hq-blue' : 'border-transparent text-slate-500 hover:text-slate-700'
  }`;

export default function RapportsLayout() {
  const { can } = useAuth();
  const location = useLocation();
  const [module, setModule] = useState(null);

  useEffect(() => {
    get('/modules/rapports').then(setModule).catch(() => {});
  }, []);

  const Icon = moduleIcon(module?.icon);
  const tabs = TABS.filter((t) => can(t.requires, 'read'));
  const isBareIndex = location.pathname.replace(/\/+$/, '').endsWith('/rapports');

  return (
    <div>
      <header className="mb-6 flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-xl" style={{ backgroundColor: module?.color || '#6366f1' }}>
          <Icon size={24} className="text-white" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-hq-blue">Rapports</h1>
          <p className="text-sm text-slate-500">Rapports de cours, d'activité et de visite, réunis au même endroit</p>
        </div>
      </header>

      {tabs.length > 1 && (
        <nav className="mb-6 flex gap-6 overflow-x-auto border-b border-slate-200">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} className={tabClass}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}

      {tabs.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun rapport accessible avec votre rôle.</p>
      ) : isBareIndex ? (
        <Navigate to={tabs[0].to} replace />
      ) : (
        <Outlet />
      )}
    </div>
  );
}

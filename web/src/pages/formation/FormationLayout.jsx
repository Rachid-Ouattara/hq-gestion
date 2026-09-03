import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { get } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { moduleIcon } from '../../lib/moduleIcons.js';

const STAFF_TABS = [
  { to: '.', label: 'Aperçu', end: true },
  { to: 'ecoles', label: 'Écoles partenaires' },
  { to: 'camps', label: 'Camps de vacances' },
  { to: 'seances', label: 'Formateurs & Planning' },
  { to: 'rapports', label: 'Rapports de cours' },
  { to: 'maintenance', label: 'Maintenance' },
];

const FORMATEUR_TABS = [
  { to: 'seances', label: 'Mon planning' },
  { to: 'rapports', label: 'Mes rapports' },
];

const tabClass = ({ isActive }) =>
  `whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
    isActive ? 'border-hq-orange text-hq-blue' : 'border-transparent text-slate-500 hover:text-slate-700'
  }`;

export default function FormationLayout() {
  const { user } = useAuth();
  const [module, setModule] = useState(null);

  useEffect(() => {
    get('/modules/formation').then(setModule).catch(() => {});
  }, []);

  const Icon = moduleIcon(module?.icon);
  const isFormateur = user?.role === 'formateur';
  const tabs = isFormateur ? FORMATEUR_TABS : STAFF_TABS;

  return (
    <div>
      <header className="mb-6 flex items-center gap-4">
        <span
          className="grid h-12 w-12 place-items-center rounded-xl"
          style={{ backgroundColor: module?.color || '#d1495b' }}
        >
          <Icon size={24} className="text-white" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-hq-blue">
            {isFormateur ? 'Mon espace formateur' : 'Formation & Écoles Partenaires'}
          </h1>
          <p className="text-sm text-slate-500">
            {isFormateur ? 'Votre planning et vos rapports de cours' : 'Écoles, camps, planning, rapports et maintenance'}
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

      <Outlet />
    </div>
  );
}

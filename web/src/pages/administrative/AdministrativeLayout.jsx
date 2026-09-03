import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { get } from '../../lib/api.js';
import { moduleIcon } from '../../lib/moduleIcons.js';

const TABS = [
  { to: '.', label: 'Aperçu', end: true },
  { to: 'courrier-entrant', label: 'Courrier entrant' },
  { to: 'courrier-sortant', label: 'Courrier sortant' },
  { to: 'archives', label: 'Classement & Archivage' },
  { to: 'documents', label: 'Documents administratifs' },
  { to: 'agenda', label: 'Agenda & Rendez-vous' },
  { to: 'notes', label: 'Notes & Mémos' },
];

const tabClass = ({ isActive }) =>
  `whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
    isActive ? 'border-hq-orange text-hq-blue' : 'border-transparent text-slate-500 hover:text-slate-700'
  }`;

export default function AdministrativeLayout() {
  const [module, setModule] = useState(null);

  useEffect(() => {
    get('/modules/administrative').then(setModule).catch(() => {});
  }, []);

  const Icon = moduleIcon(module?.icon);

  return (
    <div>
      <header className="mb-6 flex items-center gap-4">
        <span
          className="grid h-12 w-12 place-items-center rounded-xl"
          style={{ backgroundColor: module?.color || '#2456a6' }}
        >
          <Icon size={24} className="text-white" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-hq-blue">Gestion Administrative</h1>
          <p className="text-sm text-slate-500">Courrier, classement, documents, agenda et notes de service</p>
        </div>
      </header>

      <nav className="mb-6 flex gap-6 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}>
            {t.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

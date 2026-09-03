import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { get } from '../../lib/api.js';
import { moduleIcon } from '../../lib/moduleIcons.js';

const TABS = [
  { to: '.', label: 'Aperçu', end: true },
  { to: 'demandes', label: "Demandes d'achat" },
  { to: 'fournisseurs', label: 'Fournisseurs' },
  { to: 'bons', label: 'Bons de commande' },
  { to: 'receptions', label: 'Réceptions' },
  { to: 'paiements', label: 'Paiements' },
];

const tabClass = ({ isActive }) =>
  `whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
    isActive ? 'border-hq-orange text-hq-blue' : 'border-transparent text-slate-500 hover:text-slate-700'
  }`;

export default function AchatsLayout() {
  const [module, setModule] = useState(null);

  useEffect(() => {
    get('/modules/achats').then(setModule).catch(() => {});
  }, []);

  const Icon = moduleIcon(module?.icon);

  return (
    <div>
      <header className="mb-6 flex items-center gap-4">
        <span
          className="grid h-12 w-12 place-items-center rounded-xl"
          style={{ backgroundColor: module?.color || '#7b4b9e' }}
        >
          <Icon size={24} className="text-white" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-hq-blue">Gestion des Achats</h1>
          <p className="text-sm text-slate-500">Demandes, fournisseurs, commandes, réceptions et paiements</p>
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

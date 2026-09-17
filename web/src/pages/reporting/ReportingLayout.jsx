import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { get } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { moduleIcon } from '../../lib/moduleIcons.js';

const tabClass = ({ isActive }) =>
  `whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
    isActive ? 'border-hq-orange text-hq-blue' : 'border-transparent text-slate-500 hover:text-slate-700'
  }`;

export default function ReportingLayout() {
  const { user } = useAuth();
  const [module, setModule] = useState(null);

  useEffect(() => {
    get('/modules/reporting').then(setModule).catch(() => {});
  }, []);

  const Icon = moduleIcon(module?.icon);
  const isAdmin = user?.role === 'admin';

  return (
    <div>
      <header className="mb-6 flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-xl" style={{ backgroundColor: module?.color || '#5ca95c' }}>
          <Icon size={24} className="text-white" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-hq-blue">Tableaux de bord & Reporting</h1>
          <p className="text-sm text-slate-500">Indicateurs clés, tendances inter-modules et journal d'audit</p>
        </div>
      </header>

      <nav className="mb-6 flex gap-6 overflow-x-auto border-b border-slate-200">
        <NavLink to="." end className={tabClass}>Aperçu</NavLink>
        {isAdmin && <NavLink to="journal-audit" className={tabClass}>Journal d'audit</NavLink>}
      </nav>

      <Outlet />
    </div>
  );
}

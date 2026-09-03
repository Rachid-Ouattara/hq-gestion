import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck, UserCog, LogOut, X } from 'lucide-react';
import { get } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { moduleIcon } from '../lib/moduleIcons.js';
import NotificationBell from './NotificationBell.jsx';

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const [modules, setModules] = useState([]);

  useEffect(() => {
    get('/modules').then(setModules).catch(() => setModules([]));
  }, []);

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'border-hq-orange bg-white/15 text-white'
        : 'border-transparent text-slate-300 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 transform flex-col bg-hq-blue text-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center gap-2 px-5 py-5">
        <img src="/logo.jpg" alt="Headquarters" className="h-9 w-9 rounded-lg object-cover" />
        <div className="flex-1">
          <p className="text-sm font-semibold leading-tight">Headquarters</p>
          <p className="text-xs text-slate-300">Application de gestion</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden">
          <X size={20} />
        </button>
      </div>

      <NotificationBell />

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <NavLink to="/" end className={linkClass}>
          <LayoutDashboard size={18} /> Tableau de bord
        </NavLink>

        <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Modules
        </p>
        {modules.map((m) => {
          const Icon = moduleIcon(m.icon);
          return (
            <NavLink key={m.code} to={`/modules/${m.code}`} className={linkClass}>
              <span
                className="grid h-6 w-6 place-items-center rounded"
                style={{ backgroundColor: m.color }}
              >
                <Icon size={14} className="text-white" />
              </span>
              <span className="truncate">{m.name}</span>
            </NavLink>
          );
        })}

        {user?.role === 'admin' && (
          <>
            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Administration
            </p>
            <NavLink to="/admin/utilisateurs" className={linkClass}>
              <UserCog size={18} /> Utilisateurs
            </NavLink>
            <NavLink to="/admin/roles" className={linkClass}>
              <ShieldCheck size={18} /> Rôles & droits
            </NavLink>
          </>
        )}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-medium">{user?.full_name}</p>
          <p className="text-xs capitalize text-slate-400">{user?.role}</p>
        </div>
        <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
          <LogOut size={18} /> Se déconnecter
        </button>
      </div>
    </aside>
  );
}

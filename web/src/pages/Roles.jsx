import { useEffect, useState } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { get, post, patch, put, del } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import SlideOver from '../components/SlideOver.jsx';

const ACTIONS = [
  { key: 'can_read', label: 'Lire' },
  { key: 'can_create', label: 'Créer' },
  { key: 'can_update', label: 'Modifier' },
  { key: 'can_delete', label: 'Supprimer' },
  { key: 'can_validate', label: 'Valider' },
];

const EMPTY_FORM = { code: '', name: '', description: '', is_staff: false, clone_from_role_id: '' };

export default function Roles() {
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);

  const [open, setOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null); // role object being edited, or null for "nouveau"
  const [form, setForm] = useState(EMPTY_FORM);

  const load = () => get('/roles').then(setRoles).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => { get('/modules').then(setModules).catch(() => {}); }, []);

  const permOf = (role, moduleCode) =>
    role.permissions.find((p) => p.module_code === moduleCode) || {};

  const toggle = async (role, moduleCode, actionKey) => {
    const current = permOf(role, moduleCode);
    const body = {
      can_read: !!current.can_read,
      can_create: !!current.can_create,
      can_update: !!current.can_update,
      can_delete: !!current.can_delete,
      can_validate: !!current.can_validate,
      [actionKey]: !current[actionKey],
    };
    try {
      await put(`/roles/${role.id}/permissions/${moduleCode}`, body);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const ouvrirNouveau = () => {
    setEditingRole(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const ouvrirEdition = (role) => {
    setEditingRole(role);
    setForm({ code: role.code, name: role.name, description: role.description || '', is_staff: role.is_staff, clone_from_role_id: '' });
    setOpen(true);
  };

  const submit = async () => {
    try {
      if (editingRole) {
        await patch(`/roles/${editingRole.id}`, { name: form.name, description: form.description, is_staff: form.is_staff });
      } else {
        await post('/roles', {
          code: form.code,
          name: form.name,
          description: form.description,
          is_staff: form.is_staff,
          clone_from_role_id: form.clone_from_role_id || null,
        });
      }
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const supprimer = async (role) => {
    if (!window.confirm(`Supprimer le rôle « ${role.name} » ?`)) return;
    try {
      await del(`/roles/${role.id}`);
      toast.success('Supprimé');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-hq-blue">Rôles & droits</h1>
          <p className="text-sm text-slate-500">Matrice des permissions par module</p>
        </div>
        <button className="btn-primary" onClick={ouvrirNouveau}>
          <Plus size={18} /> Nouveau rôle
        </button>
      </header>

      <div className="space-y-6">
        {roles.map((role) => (
          <div key={role.id} className="card overflow-x-auto p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-800">{role.name}</h2>
                  {role.is_staff && (
                    <span className="flex items-center gap-1 rounded-full bg-hq-blue-light px-2 py-0.5 text-xs font-medium text-hq-blue">
                      <ShieldCheck size={12} /> Personnel
                    </span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {role.user_count} utilisateur{role.user_count > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{role.description || '—'}</p>
              </div>
              {!role.is_system && (
                <div className="flex gap-1">
                  <button className="rounded p-1.5 text-slate-400 hover:bg-hq-blue-light hover:text-hq-blue" onClick={() => ouvrirEdition(role)} title="Modifier">
                    <Pencil size={16} />
                  </button>
                  <button
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => supprimer(role)}
                    disabled={role.user_count > 0}
                    title={role.user_count > 0 ? 'Réaffectez les utilisateurs de ce rôle avant de le supprimer' : 'Supprimer'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Module</th>
                  {ACTIONS.map((a) => <th key={a.key} className="px-2 py-2 text-center">{a.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {modules.map((m) => {
                  const p = permOf(role, m.code);
                  return (
                    <tr key={m.code}>
                      <td className="py-2 pr-4">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                          {m.name}
                        </span>
                      </td>
                      {ACTIONS.map((a) => (
                        <td key={a.key} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-hq-blue"
                            checked={!!p[a.key]}
                            disabled={role.code === 'admin'}
                            onChange={() => toggle(role, m.code, a.key)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <SlideOver open={open} onClose={() => setOpen(false)} title={editingRole ? 'Modifier le rôle' : 'Nouveau rôle'}>
        <div className="space-y-3">
          {!editingRole && (
            <div>
              <label className="label">Code (identifiant technique)</label>
              <input
                className="input"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
                placeholder="ex. comptable"
              />
              <p className="mt-1 text-xs text-slate-400">Minuscules, chiffres, underscore. Ne pourra plus être modifié.</p>
            </div>
          )}
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.is_staff} onChange={(e) => setForm({ ...form, is_staff: e.target.checked })} />
            Rôle du personnel (accès aux zones sensibles : recrutement, contrats, candidatures…)
          </label>
          {!editingRole && (
            <div>
              <label className="label">Copier les droits depuis (optionnel)</label>
              <select className="input" value={form.clone_from_role_id} onChange={(e) => setForm({ ...form, clone_from_role_id: e.target.value })}>
                <option value="">— Aucun (partir de zéro) —</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.name.trim() || (!editingRole && !/^[a-z][a-z0-9_]*$/.test(form.code))}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

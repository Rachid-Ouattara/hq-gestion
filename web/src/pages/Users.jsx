import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { get, post, patch } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';

const ROLES_LIEES_A_UNE_FICHE_RH = ['formateur', 'employe'];

const EMPTY_FORM = { full_name: '', email: '', password: '', role_code: '', employe_id: '' };

export default function Users() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [employesDisponibles, setEmployesDisponibles] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const load = () => get('/users').then(setUsers).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    get('/roles').then((r) => {
      setRoles(r);
      setForm((f) => (f.role_code ? f : { ...f, role_code: r.find((x) => x.code === 'secretaire')?.code || r[0]?.code || '' }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ROLES_LIEES_A_UNE_FICHE_RH.includes(form.role_code)) return;
    get('/rh/employes?statut=actif').then((all) => {
      setEmployesDisponibles(all.filter((e) => !e.user_id));
    }).catch(() => {});
  }, [form.role_code]);

  const create = async () => {
    try {
      await post('/users', { ...form, employe_id: form.employe_id || null });
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggle = async (u) => {
    try {
      await patch(`/users/${u.id}/status`, { is_active: !u.is_active });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const changeRole = async (u, roleCode) => {
    try {
      await patch(`/users/${u.id}/role`, { role_code: roleCode });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-hq-blue">Utilisateurs</h1>
          <p className="text-sm text-slate-500">Gestion des comptes et des rôles</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          <UserPlus size={18} /> Nouvel utilisateur
        </button>
      </header>

      {showForm && (
        <div className="card mb-6 grid gap-3 p-5 md:grid-cols-2">
          <div>
            <label className="label">Nom complet</label>
            <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Mot de passe (≥ 8 caractères)</label>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">Rôle</label>
            <select className="input" value={form.role_code} onChange={(e) => setForm({ ...form, role_code: e.target.value, employe_id: '' })}>
              {roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
          </div>
          {ROLES_LIEES_A_UNE_FICHE_RH.includes(form.role_code) && (
            <div>
              <label className="label">Fiche employé RH liée</label>
              <select className="input" value={form.employe_id} onChange={(e) => setForm({ ...form, employe_id: e.target.value })}>
                <option value="">Sélectionner…</option>
                {employesDisponibles.map((e) => (
                  <option key={e.id} value={e.id}>{e.nom} {e.prenom} — {e.matricule}</option>
                ))}
              </select>
            </div>
          )}
          <div className="md:col-span-2">
            <button
              className="btn-primary"
              onClick={create}
              disabled={ROLES_LIEES_A_UNE_FICHE_RH.includes(form.role_code) && !form.employe_id}
            >
              Créer le compte
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-slate-700">{u.full_name}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    className="input !w-auto !py-1 text-xs"
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value)}
                  >
                    {roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-xs text-hq-blue hover:underline" onClick={() => toggle(u)}>
                    {u.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

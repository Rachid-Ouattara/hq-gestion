import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { get, tokens } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

const ACTION_LABEL = {
  create: { label: 'Création', className: 'bg-emerald-50 text-emerald-700' },
  update: { label: 'Modification', className: 'bg-hq-blue-light text-hq-blue' },
  delete: { label: 'Suppression', className: 'bg-red-50 text-red-600' },
  submit: { label: 'Soumission', className: 'bg-hq-orange/15 text-hq-orange-dark' },
  validate: { label: 'Validation', className: 'bg-emerald-50 text-emerald-700' },
  reject: { label: 'Rejet', className: 'bg-red-50 text-red-600' },
  login: { label: 'Connexion', className: 'bg-slate-100 text-slate-500' },
  reset_password: { label: 'Réinit. mot de passe', className: 'bg-slate-100 text-slate-500' },
};

const MODULE_LABEL = {
  administrative: 'Administratif',
  rh: 'Ressources Humaines',
  achats: 'Achats',
  stocks: 'Stocks',
  finance: 'Finance',
  commercial: 'Commercial',
  formation: 'Formation',
  prospection: 'Prospection',
};

const EMPTY_FILTERS = { module_code: '', action: '', user_id: '', date_from: '', date_to: '' };
const LIMIT = 50;

export default function JournalAudit() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [users, setUsers] = useState([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { get('/users').then(setUsers).catch(() => {}); }, []);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: LIMIT, offset, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    get(`/reporting/audit?${params}`)
      .then((data) => { setRows(data.rows); setTotal(data.total); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [offset, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateFilter = (key, value) => {
    setOffset(0);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      const res = await fetch(`/api/reporting/audit/export?${params}`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (!res.ok) throw new Error('Export impossible');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { key: 'created_at', label: 'Date', render: (r) => new Date(r.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) },
    { key: 'user_name', label: 'Utilisateur', render: (r) => r.user_name || '—' },
    { key: 'action', label: 'Action', render: (r) => <StatusBadge status={r.action} map={ACTION_LABEL} /> },
    { key: 'module_code', label: 'Module', render: (r) => (r.module_code ? MODULE_LABEL[r.module_code] || r.module_code : '—') },
    { key: 'entity_type', label: 'Type', render: (r) => r.entity_type || '—' },
    { key: 'entity_id', label: 'Référence', render: (r) => r.entity_id ? <span className="font-mono text-xs">{r.entity_id.slice(0, 8)}…</span> : '—' },
  ];

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Module</label>
          <select className="input" value={filters.module_code} onChange={(e) => updateFilter('module_code', e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(MODULE_LABEL).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Action</label>
          <select className="input" value={filters.action} onChange={(e) => updateFilter('action', e.target.value)}>
            <option value="">Toutes</option>
            {Object.entries(ACTION_LABEL).map(([code, { label }]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Utilisateur</label>
          <select className="input" value={filters.user_id} onChange={(e) => updateFilter('user_id', e.target.value)}>
            <option value="">Tous</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Du</label>
          <input type="date" className="input" value={filters.date_from} onChange={(e) => updateFilter('date_from', e.target.value)} />
        </div>
        <div>
          <label className="label">Au</label>
          <input type="date" className="input" value={filters.date_to} onChange={(e) => updateFilter('date_to', e.target.value)} />
        </div>
        <button className="btn-ghost" onClick={exportExcel} disabled={exporting}>
          <Download size={16} /> {exporting ? 'Export…' : 'Exporter en Excel'}
        </button>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucune action enregistrée." />

      <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
        <p>{total > 0 ? `${from}–${to} sur ${total}` : '0 résultat'}</p>
        <div className="flex gap-2">
          <button className="btn-ghost !py-1.5 text-xs" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
            Précédent
          </button>
          <button className="btn-ghost !py-1.5 text-xs" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}>
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}

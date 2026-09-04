import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { ARCHIVE_STATUT } from './statusMaps.js';

const EMPTY_FORM = { code: '', libelle: '', type_support: 'physique', emplacement: '', observations: '' };

export default function Archives() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [q, setQ] = useState('');
  const [statutFilter, setStatutFilter] = useState('');

  const canCreate = can('administrative', 'create');

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (statutFilter) params.set('statut', statutFilter);
    get(`/administrative/archives?${params}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [statutFilter]);

  const submit = async () => {
    try {
      await post('/administrative/archives', form);
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'libelle', label: 'Libellé' },
    { key: 'type_support', label: 'Support', render: (a) => (a.type_support === 'physique' ? 'Physique' : 'Numérique') },
    { key: 'emplacement', label: 'Emplacement', render: (a) => a.emplacement || '—' },
    { key: 'statut', label: 'Statut', render: (a) => <StatusBadge status={a.statut} map={ARCHIVE_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} dossier(s) d'archive</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau dossier
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher un code, un libellé…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            onBlur={load}
          />
        </div>
        <select className="input w-auto" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(ARCHIVE_STATUT).map(([code, s]) => <option key={code} value={code}>{s.label}</option>)}
        </select>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`/modules/administrative/archives/${r.id}`)} emptyLabel="Aucun dossier d'archive." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau dossier d'archive">
        <div className="space-y-3">
          <div>
            <label className="label">Code</label>
            <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex. ARC-RH-2026" />
          </div>
          <div>
            <label className="label">Libellé</label>
            <input className="input" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </div>
          <div>
            <label className="label">Support</label>
            <select className="input" value={form.type_support} onChange={(e) => setForm({ ...form, type_support: e.target.value })}>
              <option value="physique">Physique</option>
              <option value="numerique">Numérique</option>
            </select>
          </div>
          <div>
            <label className="label">Emplacement</label>
            <input className="input" placeholder="Ex. Armoire 3, Étagère B" value={form.emplacement} onChange={(e) => setForm({ ...form, emplacement: e.target.value })} />
          </div>
          <div>
            <label className="label">Observations</label>
            <textarea className="input" rows={2} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.code.trim() || !form.libelle.trim()}>Enregistrer</button>
        </div>
      </SlideOver>
    </div>
  );
}

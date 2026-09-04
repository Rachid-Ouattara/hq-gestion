import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { COURRIER_STATUT } from './statusMaps.js';

const LABELS = {
  entrant: { title: 'Courrier entrant', action: 'Nouveau courrier entrant', correspondant: 'Expéditeur' },
  sortant: { title: 'Courrier sortant', action: 'Nouveau courrier sortant', correspondant: 'Destinataire' },
};

const EMPTY_FORM = { objet: '', correspondant: '', mode_transmission: '', observations: '' };

export default function Courrier({ sens }) {
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
  const labels = LABELS[sens];

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ sens });
    if (q) params.set('q', q);
    if (statutFilter) params.set('statut', statutFilter);
    get(`/administrative/courrier?${params}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [sens, statutFilter]);

  const submit = async () => {
    try {
      await post('/administrative/courrier', { ...form, sens });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'objet', label: 'Objet' },
    { key: 'correspondant', label: labels.correspondant },
    { key: 'date_courrier', label: 'Date', render: (r) => new Date(r.date_courrier).toLocaleDateString('fr-FR') },
    { key: 'statut', label: 'Statut', render: (r) => <StatusBadge status={r.statut} map={COURRIER_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} courrier(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> {labels.action}
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher un objet, un correspondant…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            onBlur={load}
          />
        </div>
        <select className="input w-auto" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(COURRIER_STATUT).map(([code, s]) => <option key={code} value={code}>{s.label}</option>)}
        </select>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`/modules/administrative/courrier/${r.id}`)} emptyLabel={`Aucun ${labels.title.toLowerCase()}.`} />

      <SlideOver open={open} onClose={() => setOpen(false)} title={labels.action}>
        <div className="space-y-3">
          <div>
            <label className="label">Objet</label>
            <input className="input" value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
          </div>
          <div>
            <label className="label">{labels.correspondant}</label>
            <input className="input" value={form.correspondant} onChange={(e) => setForm({ ...form, correspondant: e.target.value })} />
          </div>
          <div>
            <label className="label">Mode de transmission</label>
            <input className="input" placeholder="Physique, e-mail, fax…" value={form.mode_transmission} onChange={(e) => setForm({ ...form, mode_transmission: e.target.value })} />
          </div>
          <div>
            <label className="label">Observations</label>
            <textarea className="input" rows={2} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.objet.trim() || !form.correspondant.trim()}>
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

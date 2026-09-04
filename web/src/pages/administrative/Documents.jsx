import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { DOCUMENT_STATUT, DOCUMENT_TYPE_LABEL } from './statusMaps.js';

const EMPTY_FORM = { type_document: 'contrat', titre: '', description: '', date_expiration: '' };

export default function Documents() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState('');

  const canCreate = can('administrative', 'create');

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (typeFilter) params.set('type_document', typeFilter);
    if (statutFilter) params.set('statut', statutFilter);
    get(`/administrative/documents?${params}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [typeFilter, statutFilter]);

  const submit = async () => {
    try {
      await post('/administrative/documents', form);
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
    { key: 'titre', label: 'Titre' },
    { key: 'type_document', label: 'Type', render: (d) => DOCUMENT_TYPE_LABEL[d.type_document] || d.type_document },
    { key: 'date_document', label: 'Date', render: (d) => new Date(d.date_document).toLocaleDateString('fr-FR') },
    { key: 'statut', label: 'Statut', render: (d) => <StatusBadge status={d.statut} map={DOCUMENT_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} document(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau document
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher un titre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            onBlur={load}
          />
        </div>
        <select className="input w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tous les types</option>
          {Object.entries(DOCUMENT_TYPE_LABEL).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
        <select className="input w-auto" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(DOCUMENT_STATUT).map(([code, s]) => <option key={code} value={code}>{s.label}</option>)}
        </select>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`/modules/administrative/documents/${r.id}`)} emptyLabel="Aucun document enregistré." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau document">
        <div className="space-y-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type_document} onChange={(e) => setForm({ ...form, type_document: e.target.value })}>
              {Object.entries(DOCUMENT_TYPE_LABEL).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Titre</label>
            <input className="input" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Date d'expiration (optionnel)</label>
            <input className="input" type="date" value={form.date_expiration} onChange={(e) => setForm({ ...form, date_expiration: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.titre.trim()}>Enregistrer</button>
        </div>
      </SlideOver>
    </div>
  );
}

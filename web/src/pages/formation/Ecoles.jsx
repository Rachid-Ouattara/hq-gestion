import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import Camps from './Camps.jsx';
import Maintenance from './Maintenance.jsx';
import { ECOLE_STATUT } from './statusMaps.js';

const EMPTY_FORM = { nom: '', ville: '', adresse: '', contact_nom: '', contact_telephone: '', contact_email: '' };

const SUB_TABS = [
  { key: 'liste', label: 'Liste des écoles' },
  { key: 'camps', label: 'Camps de vacances' },
  { key: 'maintenance', label: 'Maintenance' },
];

function ListeEcoles() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('formation', 'create');

  const load = () => get('/formation/ecoles').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/formation/ecoles', form);
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'nom', label: 'École' },
    { key: 'ville', label: 'Ville' },
    { key: 'contact_nom', label: 'Contact', render: (r) => r.contact_nom || '—' },
    { key: 'contact_telephone', label: 'Téléphone', render: (r) => r.contact_telephone || '—' },
    { key: 'statut_partenariat', label: 'Statut', render: (r) => <StatusBadge status={r.statut_partenariat} map={ECOLE_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} école(s) partenaire(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle école
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucune école partenaire." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle école partenaire">
        <div className="space-y-3">
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div>
            <label className="label">Ville</label>
            <input className="input" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
          </div>
          <div>
            <label className="label">Adresse</label>
            <input className="input" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact</label>
              <input className="input" value={form.contact_nom} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.contact_telephone} onChange={(e) => setForm({ ...form, contact_telephone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.nom.trim() || !form.ville.trim()}>Enregistrer</button>
        </div>
      </SlideOver>
    </div>
  );
}

export default function Ecoles() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = SUB_TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'liste';

  const selectTab = (key) => {
    if (key === 'liste') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', key);
    }
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <div>
      <div className="mb-5 flex gap-1 rounded-lg border border-slate-200 bg-white p-1" style={{ width: 'fit-content' }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === t.key ? 'bg-hq-blue text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'liste' && <ListeEcoles />}
      {activeTab === 'camps' && <Camps />}
      {activeTab === 'maintenance' && <Maintenance />}
    </div>
  );
}

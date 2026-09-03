import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { POSTE_STATUT, TYPE_CONTRAT_LABEL } from './statusMaps.js';

const EMPTY_FORM = { titre: '', departement: '', type_contrat: 'cdi', nombre_postes: '1', description: '' };

export default function Recrutement() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('rh', 'create');

  const load = () => get('/rh/postes').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/rh/postes', { ...form, nombre_postes: Number(form.nombre_postes) });
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
    { key: 'titre', label: 'Poste' },
    { key: 'departement', label: 'Département', render: (p) => p.departement || '—' },
    { key: 'type_contrat', label: 'Contrat', render: (p) => TYPE_CONTRAT_LABEL[p.type_contrat] || p.type_contrat },
    { key: 'nb_candidats', label: 'Candidats' },
    { key: 'statut', label: 'Statut', render: (p) => <StatusBadge status={p.statut} map={POSTE_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} poste(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau poste
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucun poste ouvert." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau poste">
        <div className="space-y-3">
          <div>
            <label className="label">Titre du poste</label>
            <input className="input" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Ex. Formateur IA junior" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Département</label>
              <input className="input" value={form.departement} onChange={(e) => setForm({ ...form, departement: e.target.value })} />
            </div>
            <div>
              <label className="label">Type de contrat</label>
              <select className="input" value={form.type_contrat} onChange={(e) => setForm({ ...form, type_contrat: e.target.value })}>
                {Object.entries(TYPE_CONTRAT_LABEL).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Nombre de postes</label>
            <input className="input" type="number" min="1" value={form.nombre_postes} onChange={(e) => setForm({ ...form, nombre_postes: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.titre.trim()}>
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

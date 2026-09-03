import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { CAMPAGNE_STATUT } from './statusMaps.js';

const EMPTY_FORM = { nom: '', annee: String(new Date().getFullYear()), date_debut: '', date_fin: '' };

export default function Campagnes() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('prospection', 'create');

  const load = () => get('/prospection/campagnes').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/prospection/campagnes', { ...form, annee: Number(form.annee) });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'nom', label: 'Campagne' },
    { key: 'annee', label: 'Année' },
    { key: 'date_debut', label: 'Période', render: (c) => `${new Date(c.date_debut).toLocaleDateString('fr-FR')} → ${new Date(c.date_fin).toLocaleDateString('fr-FR')}` },
    { key: 'statut', label: 'Statut', render: (c) => <StatusBadge status={c.statut} map={CAMPAGNE_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} campagne(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle campagne
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucune campagne de prospection." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle campagne">
        <div className="space-y-3">
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex. Campagne Vacances 2026" />
          </div>
          <div>
            <label className="label">Année</label>
            <input className="input" type="number" value={form.annee} onChange={(e) => setForm({ ...form, annee: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date de début</label>
              <input className="input" type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
            </div>
            <div>
              <label className="label">Date de fin</label>
              <input className="input" type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
            </div>
          </div>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.nom.trim() || !form.date_debut || !form.date_fin}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

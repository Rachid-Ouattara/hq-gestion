import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { FORMATION_STATUT } from './statusMaps.js';

const EMPTY_FORM = { titre: '', organisme: '', lieu: '', date_debut: '', date_fin: '', cout: '0' };

export default function Formations() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('rh', 'create');

  const load = () => get('/rh/formations').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      const created = await post('/rh/formations', { ...form, cout: Number(form.cout) });
      setForm(EMPTY_FORM);
      setOpen(false);
      navigate(`${created.id}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'titre', label: 'Titre' },
    { key: 'organisme', label: 'Organisme', render: (f) => f.organisme || '—' },
    { key: 'date_debut', label: 'Dates', render: (f) => `${new Date(f.date_debut).toLocaleDateString('fr-FR')} → ${new Date(f.date_fin).toLocaleDateString('fr-FR')}` },
    { key: 'nb_participants', label: 'Participants' },
    { key: 'statut', label: 'Statut', render: (f) => <StatusBadge status={f.statut} map={FORMATION_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} formation(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle formation
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucune formation planifiée." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle formation">
        <div className="space-y-3">
          <div>
            <label className="label">Titre</label>
            <input className="input" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Organisme</label>
              <input className="input" value={form.organisme} onChange={(e) => setForm({ ...form, organisme: e.target.value })} />
            </div>
            <div>
              <label className="label">Lieu</label>
              <input className="input" value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} />
            </div>
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
          <div>
            <label className="label">Coût</label>
            <input className="input" type="number" min="0" step="0.01" value={form.cout} onChange={(e) => setForm({ ...form, cout: e.target.value })} />
          </div>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.titre.trim() || !form.date_debut || !form.date_fin}
          >
            Créer et gérer les participants
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

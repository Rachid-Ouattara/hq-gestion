import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { get, post, patch } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { CAMP_STATUT } from './statusMaps.js';

const EMPTY_FORM = { nom: '', lieu: '', ville: '', date_debut: '', date_fin: '', responsable_nom: '', responsable_telephone: '' };

export default function Camps() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('formation', 'create');
  const canUpdate = can('formation', 'update');

  const load = () => get('/formation/camps').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/formation/camps', form);
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const changerStatut = async (row, statut) => {
    try {
      await patch(`/formation/camps/${row.id}/statut`, { statut });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'nom', label: 'Camp' },
    { key: 'lieu', label: 'Lieu', render: (c) => `${c.lieu}${c.ville ? `, ${c.ville}` : ''}` },
    { key: 'date_debut', label: 'Dates', render: (c) => `${new Date(c.date_debut).toLocaleDateString('fr-FR')} → ${new Date(c.date_fin).toLocaleDateString('fr-FR')}` },
    { key: 'statut', label: 'Statut', render: (c) => <StatusBadge status={c.statut} map={CAMP_STATUT} /> },
    ...(canUpdate
      ? [{
          key: 'actions',
          label: '',
          render: (c) => c.statut === 'planifie' && (
            <button className="text-xs text-hq-blue hover:underline" onClick={() => changerStatut(c, 'en_cours')}>Démarrer</button>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} camp(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau camp
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucun camp de vacances." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau camp de vacances">
        <div className="space-y-3">
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Lieu</label>
              <input className="input" value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} />
            </div>
            <div>
              <label className="label">Ville</label>
              <input className="input" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Responsable</label>
              <input className="input" value={form.responsable_nom} onChange={(e) => setForm({ ...form, responsable_nom: e.target.value })} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.responsable_telephone} onChange={(e) => setForm({ ...form, responsable_telephone: e.target.value })} />
            </div>
          </div>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.nom.trim() || !form.lieu.trim() || !form.date_debut || !form.date_fin}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

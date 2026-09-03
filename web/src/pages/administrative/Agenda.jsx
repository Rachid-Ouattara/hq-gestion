import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { AGENDA_STATUT } from './statusMaps.js';

const EMPTY_FORM = { titre: '', description: '', date_debut: '', date_fin: '', lieu: '', participants: '' };

export default function Agenda() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('administrative', 'create');
  const canUpdate = can('administrative', 'update');

  const load = () => get('/administrative/agenda').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/administrative/agenda', form);
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const annuler = async (row) => {
    if (!window.confirm(`Annuler « ${row.titre} » ?`)) return;
    try {
      await post(`/administrative/agenda/${row.id}/annuler`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'titre', label: 'Titre' },
    {
      key: 'date_debut',
      label: 'Début',
      render: (a) => new Date(a.date_debut).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
    },
    {
      key: 'date_fin',
      label: 'Fin',
      render: (a) => new Date(a.date_fin).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
    },
    { key: 'lieu', label: 'Lieu', render: (a) => a.lieu || '—' },
    { key: 'statut', label: 'Statut', render: (a) => <StatusBadge status={a.statut} map={AGENDA_STATUT} /> },
    ...(canUpdate
      ? [{
          key: 'actions',
          label: '',
          render: (a) => a.statut === 'planifie' && (
            <button className="text-xs text-hq-blue hover:underline" onClick={() => annuler(a)}>Annuler</button>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} événement(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau rendez-vous
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucun événement planifié." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau rendez-vous">
        <div className="space-y-3">
          <div>
            <label className="label">Titre</label>
            <input className="input" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Début</label>
              <input className="input" type="datetime-local" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
            </div>
            <div>
              <label className="label">Fin</label>
              <input className="input" type="datetime-local" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Lieu</label>
            <input className="input" value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} />
          </div>
          <div>
            <label className="label">Participants</label>
            <input className="input" placeholder="Ex. Direction, Chefs de service" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.titre.trim() || !form.date_debut || !form.date_fin}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

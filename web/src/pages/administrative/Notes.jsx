import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { NOTE_STATUT } from './statusMaps.js';

const EMPTY_FORM = { objet: '', contenu: '', destinataires: '' };

export default function Notes() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('administrative', 'create');
  const canUpdate = can('administrative', 'update');

  const load = () => get('/administrative/notes').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/administrative/notes', form);
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const diffuser = async (row) => {
    try {
      await post(`/administrative/notes/${row.id}/diffuser`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'objet', label: 'Objet' },
    { key: 'destinataires', label: 'Destinataires', render: (n) => n.destinataires || '—' },
    { key: 'date_note', label: 'Date', render: (n) => new Date(n.date_note).toLocaleDateString('fr-FR') },
    { key: 'statut', label: 'Statut', render: (n) => <StatusBadge status={n.statut} map={NOTE_STATUT} /> },
    ...(canUpdate
      ? [{
          key: 'actions',
          label: '',
          render: (n) => n.statut === 'brouillon' && (
            <button className="text-xs text-hq-blue hover:underline" onClick={() => diffuser(n)}>Diffuser</button>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} note(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle note
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucune note enregistrée." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle note de service">
        <div className="space-y-3">
          <div>
            <label className="label">Objet</label>
            <input className="input" value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
          </div>
          <div>
            <label className="label">Destinataires</label>
            <input className="input" placeholder="Ex. Tous les chefs de service" value={form.destinataires} onChange={(e) => setForm({ ...form, destinataires: e.target.value })} />
          </div>
          <div>
            <label className="label">Contenu</label>
            <textarea className="input" rows={5} value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.objet.trim() || !form.contenu.trim()}>
            Enregistrer en brouillon
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

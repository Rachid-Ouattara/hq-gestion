import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { COURRIER_STATUT } from '../administrative/statusMaps.js';

const EMPTY_FORM = { objet: '', correspondant: '', observations: '' };

export default function MesCourriers() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = () => get('/administrative/courrier').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/administrative/courrier', { ...form, sens: 'sortant' });
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
    { key: 'correspondant', label: 'Correspondant' },
    { key: 'date_courrier', label: 'Date', render: (c) => new Date(c.date_courrier).toLocaleDateString('fr-FR') },
    { key: 'statut', label: 'Statut', render: (c) => <StatusBadge status={c.statut} map={COURRIER_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} courrier(s)</p>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus size={18} /> Nouveau courrier
        </button>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucun courrier soumis." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau courrier">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Votre demande sera transmise au secrétariat pour envoi.</p>
          <div>
            <label className="label">Objet</label>
            <input className="input" value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
          </div>
          <div>
            <label className="label">Correspondant (destinataire)</label>
            <input className="input" value={form.correspondant} onChange={(e) => setForm({ ...form, correspondant: e.target.value })} />
          </div>
          <div>
            <label className="label">Observations</label>
            <textarea className="input" rows={3} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.objet.trim() || !form.correspondant.trim()}>
            Envoyer au secrétariat
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

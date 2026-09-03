import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
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
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archives, setArchives] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('administrative', 'create');
  const canUpdate = can('administrative', 'update');
  const labels = LABELS[sens];

  const load = () => get(`/administrative/courrier?sens=${sens}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, [sens]);
  useEffect(() => { get('/administrative/archives?statut=ouvert').then(setArchives).catch(() => {}); }, []);

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

  const archiver = async (row) => {
    if (archives.length === 0) {
      toast.error("Créez d'abord un dossier d'archive (onglet Classement & Archivage).");
      return;
    }
    try {
      await post(`/administrative/courrier/${row.id}/archiver`, { archive_id: archives[0].id });
      toast.success('Mis à jour');
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
    ...(canUpdate
      ? [{
          key: 'actions',
          label: '',
          render: (r) => r.statut !== 'archive' && (
            <button className="text-xs text-hq-blue hover:underline" onClick={() => archiver(r)}>Archiver</button>
          ),
        }]
      : []),
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

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel={`Aucun ${labels.title.toLowerCase()}.`} />

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

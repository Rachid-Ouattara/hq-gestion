import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { ARCHIVE_STATUT } from './statusMaps.js';

const EMPTY_FORM = { code: '', libelle: '', type_support: 'physique', emplacement: '', observations: '' };

export default function Archives() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('administrative', 'create');
  const canUpdate = can('administrative', 'update');

  const load = () => get('/administrative/archives').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/administrative/archives', form);
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const cloturer = async (row) => {
    if (!window.confirm(`Clôturer le dossier ${row.code} ?`)) return;
    try {
      await post(`/administrative/archives/${row.id}/cloturer`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'libelle', label: 'Libellé' },
    { key: 'type_support', label: 'Support', render: (a) => (a.type_support === 'physique' ? 'Physique' : 'Numérique') },
    { key: 'emplacement', label: 'Emplacement', render: (a) => a.emplacement || '—' },
    { key: 'statut', label: 'Statut', render: (a) => <StatusBadge status={a.statut} map={ARCHIVE_STATUT} /> },
    ...(canUpdate
      ? [{
          key: 'actions',
          label: '',
          render: (a) => a.statut === 'ouvert' && (
            <button className="text-xs text-hq-blue hover:underline" onClick={() => cloturer(a)}>Clôturer</button>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} dossier(s) d'archive</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau dossier
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucun dossier d'archive." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau dossier d'archive">
        <div className="space-y-3">
          <div>
            <label className="label">Code</label>
            <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex. ARC-RH-2026" />
          </div>
          <div>
            <label className="label">Libellé</label>
            <input className="input" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </div>
          <div>
            <label className="label">Support</label>
            <select className="input" value={form.type_support} onChange={(e) => setForm({ ...form, type_support: e.target.value })}>
              <option value="physique">Physique</option>
              <option value="numerique">Numérique</option>
            </select>
          </div>
          <div>
            <label className="label">Emplacement</label>
            <input className="input" placeholder="Ex. Armoire 3, Étagère B" value={form.emplacement} onChange={(e) => setForm({ ...form, emplacement: e.target.value })} />
          </div>
          <div>
            <label className="label">Observations</label>
            <textarea className="input" rows={2} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.code.trim() || !form.libelle.trim()}>Enregistrer</button>
        </div>
      </SlideOver>
    </div>
  );
}

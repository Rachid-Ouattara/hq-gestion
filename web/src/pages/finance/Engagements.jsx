import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { get, post, patch } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { ENGAGEMENT_STATUT_LABEL } from './statusMaps.js';

const EMPTY_FORM = { libelle: '', montant: '0', echeance: '', responsable_id: '', notes: '' };
const NEXT_STATUT = { a_payer: 'en_cours', en_cours: 'solde' };

export default function Engagements() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('finance', 'create');
  const canUpdate = can('finance', 'update');

  const load = () => get('/finance/engagements').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => { get('/finance/engagements/responsables').then(setUsers).catch(() => {}); }, []);

  const submit = async () => {
    try {
      await post('/finance/engagements', { ...form, montant: Number(form.montant), responsable_id: form.responsable_id || null });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const avancerStatut = async (e) => {
    const next = NEXT_STATUT[e.statut];
    if (!next) return;
    try {
      await patch(`/finance/engagements/${e.id}/statut`, { statut: next });
      toast.success('Statut mis à jour');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'libelle', label: 'Libellé' },
    { key: 'responsable_nom', label: 'Responsable', render: (e) => e.responsable_nom || '—' },
    { key: 'echeance', label: 'Échéance', render: (e) => (e.echeance ? new Date(e.echeance).toLocaleDateString('fr-FR') : '—') },
    { key: 'montant', label: 'Montant', render: (e) => Number(e.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) },
    { key: 'statut', label: 'Statut', render: (e) => <StatusBadge status={e.statut} map={ENGAGEMENT_STATUT_LABEL} /> },
    {
      key: 'actions',
      label: '',
      render: (e) => canUpdate && NEXT_STATUT[e.statut] && (
        <button className="text-xs text-hq-blue hover:underline" onClick={() => avancerStatut(e)}>
          Marquer « {ENGAGEMENT_STATUT_LABEL[NEXT_STATUT[e.statut]].label} »
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} engagement(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvel engagement
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucun engagement enregistré." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvel engagement">
        <div className="space-y-3">
          <div>
            <label className="label">Libellé</label>
            <input className="input" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Montant</label>
              <input className="input" type="number" min="0" step="0.01" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
            </div>
            <div>
              <label className="label">Échéance</label>
              <input className="input" type="date" value={form.echeance} onChange={(e) => setForm({ ...form, echeance: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Responsable</label>
            <select className="input" value={form.responsable_id} onChange={(e) => setForm({ ...form, responsable_id: e.target.value })}>
              <option value="">— Non assigné —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.libelle.trim() || Number(form.montant) <= 0}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { BUDGET_STATUS } from './statusMaps.js';

const EMPTY_FORM = { exercice: String(new Date().getFullYear()), libelle: '', departement: '', montant_prevu: '0' };

export default function Budgets() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('finance', 'create');

  const load = () => get('/finance/budgets').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/finance/budgets', { ...form, montant_prevu: Number(form.montant_prevu) });
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
    { key: 'libelle', label: 'Libellé' },
    { key: 'exercice', label: 'Exercice' },
    { key: 'montant_prevu', label: 'Prévu', render: (b) => Number(b.montant_prevu).toLocaleString('fr-FR') },
    { key: 'montant_realise', label: 'Réalisé', render: (b) => Number(b.montant_realise).toLocaleString('fr-FR') },
    { key: 'statut', label: 'Statut', render: (b) => <StatusBadge status={b.statut} map={BUDGET_STATUS} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} budget(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau budget
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucun budget enregistré." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau budget">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Exercice</label>
              <input className="input" value={form.exercice} onChange={(e) => setForm({ ...form, exercice: e.target.value })} />
            </div>
            <div>
              <label className="label">Département</label>
              <input className="input" value={form.departement} onChange={(e) => setForm({ ...form, departement: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Libellé</label>
            <input className="input" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </div>
          <div>
            <label className="label">Montant prévu</label>
            <input className="input" type="number" min="0" step="0.01" value={form.montant_prevu} onChange={(e) => setForm({ ...form, montant_prevu: e.target.value })} />
          </div>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.exercice.trim() || !form.libelle.trim()}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

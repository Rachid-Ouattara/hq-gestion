import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { PAIE_STATUT } from './statusMaps.js';

const EMPTY_FORM = { employe_id: '', periode: '', salaire_base: '0', primes: '0', deductions: '0' };

export default function Paies() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employes, setEmployes] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('rh', 'create');
  const canUpdate = can('rh', 'update');

  const load = () => get('/rh/paies').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => { get('/rh/employes?statut=actif').then(setEmployes).catch(() => {}); }, []);

  const onSelectEmploye = (id) => {
    const emp = employes.find((e) => e.id === id);
    setForm({ ...form, employe_id: id, salaire_base: emp ? String(emp.salaire_base) : form.salaire_base });
  };

  const submit = async () => {
    try {
      await post('/rh/paies', {
        ...form,
        salaire_base: Number(form.salaire_base),
        primes: Number(form.primes),
        deductions: Number(form.deductions),
      });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const payer = async (row) => {
    try {
      await post(`/rh/paies/${row.id}/payer`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'employe_nom', label: 'Employé', render: (p) => `${p.employe_nom} ${p.employe_prenom}` },
    { key: 'periode', label: 'Période' },
    { key: 'salaire_net', label: 'Salaire net', render: (p) => Number(p.salaire_net).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) },
    { key: 'statut', label: 'Statut', render: (p) => <StatusBadge status={p.statut} map={PAIE_STATUT} /> },
    ...(canUpdate
      ? [{
          key: 'actions',
          label: '',
          render: (p) => p.statut === 'brouillon' && (
            <button className="text-xs text-hq-blue hover:underline" onClick={() => payer(p)}>Marquer payée</button>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} paie(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle paie
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucune paie enregistrée." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle paie">
        <div className="space-y-3">
          <div>
            <label className="label">Employé</label>
            <select className="input" value={form.employe_id} onChange={(e) => onSelectEmploye(e.target.value)}>
              <option value="">Sélectionner…</option>
              {employes.map((e) => (
                <option key={e.id} value={e.id}>{e.nom} {e.prenom} — {e.matricule}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Période (AAAA-MM)</label>
            <input className="input" placeholder="2026-09" value={form.periode} onChange={(e) => setForm({ ...form, periode: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Salaire de base</label>
              <input className="input" type="number" min="0" step="0.01" value={form.salaire_base} onChange={(e) => setForm({ ...form, salaire_base: e.target.value })} />
            </div>
            <div>
              <label className="label">Primes</label>
              <input className="input" type="number" min="0" step="0.01" value={form.primes} onChange={(e) => setForm({ ...form, primes: e.target.value })} />
            </div>
            <div>
              <label className="label">Déductions</label>
              <input className="input" type="number" min="0" step="0.01" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} />
            </div>
          </div>
          <p className="text-right text-sm font-medium text-slate-600">
            Net : {(Number(form.salaire_base) + Number(form.primes) - Number(form.deductions)).toLocaleString('fr-FR')}
          </p>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.employe_id || !/^\d{4}-\d{2}$/.test(form.periode)}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

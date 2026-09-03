import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { get, post, patch } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { COMPTE_TYPE_LABEL } from './statusMaps.js';

const EMPTY_FORM = { code: '', libelle: '', type: 'actif' };
const ACTIVE_MAP = {
  true: { label: 'Actif', className: 'bg-emerald-50 text-emerald-700' },
  false: { label: 'Inactif', className: 'bg-slate-100 text-slate-500' },
};

export default function Comptes() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('finance', 'create');
  const canUpdate = can('finance', 'update');

  const load = () => get('/finance/comptes').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/finance/comptes', form);
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggle = async (c) => {
    try {
      await patch(`/finance/comptes/${c.id}/statut`, { is_active: !c.is_active });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'libelle', label: 'Libellé' },
    { key: 'type', label: 'Type', render: (c) => COMPTE_TYPE_LABEL[c.type] || c.type },
    {
      key: 'solde',
      label: 'Solde',
      render: (c) => (
        <span className={Number(c.solde) < 0 ? 'text-red-600' : 'text-emerald-700'}>
          {Number(c.solde).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { key: 'is_active', label: 'Statut', render: (c) => <StatusBadge status={String(c.is_active)} map={ACTIVE_MAP} /> },
    ...(canUpdate
      ? [{
          key: 'actions',
          label: '',
          render: (c) => (
            <button className="text-xs text-hq-blue hover:underline" onClick={() => toggle(c)}>
              {c.is_active ? 'Désactiver' : 'Activer'}
            </button>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} compte(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau compte
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucun compte enregistré." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau compte">
        <div className="space-y-3">
          <div>
            <label className="label">Code</label>
            <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex. 512" />
          </div>
          <div>
            <label className="label">Libellé</label>
            <input className="input" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} placeholder="Ex. Banque BOA" />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(COMPTE_TYPE_LABEL).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.code.trim() || !form.libelle.trim()}>Enregistrer</button>
        </div>
      </SlideOver>
    </div>
  );
}

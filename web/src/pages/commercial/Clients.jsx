import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { get, post, patch } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';

const EMPTY_FORM = { nom: '', contact_nom: '', telephone: '', email: '', adresse: '', numero_fiscal: '' };
const ACTIVE_MAP = {
  true: { label: 'Actif', className: 'bg-emerald-50 text-emerald-700' },
  false: { label: 'Inactif', className: 'bg-slate-100 text-slate-500' },
};

export default function Clients() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('commercial', 'create');
  const canUpdate = can('commercial', 'update');

  const load = () => get('/commercial/clients').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/commercial/clients', form);
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
      await patch(`/commercial/clients/${c.id}/statut`, { is_active: !c.is_active });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'nom', label: 'Nom' },
    { key: 'contact_nom', label: 'Contact', render: (r) => r.contact_nom || '—' },
    { key: 'telephone', label: 'Téléphone', render: (r) => r.telephone || '—' },
    { key: 'email', label: 'E-mail', render: (r) => r.email || '—' },
    { key: 'is_active', label: 'Statut', render: (r) => <StatusBadge status={String(r.is_active)} map={ACTIVE_MAP} /> },
    ...(canUpdate
      ? [{
          key: 'actions',
          label: '',
          render: (r) => (
            <button className="text-xs text-hq-blue hover:underline" onClick={() => toggle(r)}>
              {r.is_active ? 'Désactiver' : 'Activer'}
            </button>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} client(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau client
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucun client enregistré." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau client">
        <div className="space-y-3">
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div>
            <label className="label">Personne à contacter</label>
            <input className="input" value={form.contact_nom} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Adresse</label>
            <input className="input" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </div>
          <div>
            <label className="label">Numéro fiscal (IFU)</label>
            <input className="input" value={form.numero_fiscal} onChange={(e) => setForm({ ...form, numero_fiscal: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.nom.trim()}>Enregistrer</button>
        </div>
      </SlideOver>
    </div>
  );
}

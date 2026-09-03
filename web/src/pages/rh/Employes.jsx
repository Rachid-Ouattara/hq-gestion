import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { EMPLOYE_STATUT, TYPE_CONTRAT_LABEL } from './statusMaps.js';

const EMPTY_FORM = {
  matricule: '', nom: '', prenom: '', poste: '', departement: '',
  type_contrat: 'cdi', salaire_base: '0', telephone: '', email: '', responsable_id: '',
};

export default function Employes() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('rh', 'create');

  const load = () => get('/rh/employes').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/rh/employes', { ...form, salaire_base: Number(form.salaire_base), responsable_id: form.responsable_id || null });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'matricule', label: 'Matricule' },
    { key: 'nom', label: 'Nom', render: (e) => `${e.nom} ${e.prenom}` },
    { key: 'poste', label: 'Poste' },
    { key: 'departement', label: 'Département', render: (e) => e.departement || '—' },
    { key: 'responsable', label: 'Responsable', render: (e) => (e.responsable_nom ? `${e.responsable_nom} ${e.responsable_prenom}` : '—') },
    { key: 'type_contrat', label: 'Contrat', render: (e) => TYPE_CONTRAT_LABEL[e.type_contrat] || e.type_contrat },
    { key: 'salaire_base', label: 'Salaire de base', render: (e) => Number(e.salaire_base).toLocaleString('fr-FR') },
    { key: 'statut', label: 'Statut', render: (e) => <StatusBadge status={e.statut} map={EMPLOYE_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} employé(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvel employé
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(r.id)} emptyLabel="Aucun employé enregistré." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvel employé">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Matricule</label>
              <input className="input" value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} />
            </div>
            <div>
              <label className="label">Type de contrat</label>
              <select className="input" value={form.type_contrat} onChange={(e) => setForm({ ...form, type_contrat: e.target.value })}>
                {Object.entries(TYPE_CONTRAT_LABEL).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nom</label>
              <input className="input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
            <div>
              <label className="label">Prénom</label>
              <input className="input" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Poste</label>
              <input className="input" value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} />
            </div>
            <div>
              <label className="label">Département</label>
              <input className="input" value={form.departement} onChange={(e) => setForm({ ...form, departement: e.target.value })} />
            </div>
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
            <label className="label">Salaire de base</label>
            <input className="input" type="number" min="0" step="0.01" value={form.salaire_base} onChange={(e) => setForm({ ...form, salaire_base: e.target.value })} />
          </div>
          <div>
            <label className="label">Responsable (optionnel)</label>
            <select className="input" value={form.responsable_id} onChange={(e) => setForm({ ...form, responsable_id: e.target.value })}>
              <option value="">— Aucun —</option>
              {rows.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.nom} {emp.prenom}</option>
              ))}
            </select>
          </div>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.matricule.trim() || !form.nom.trim() || !form.prenom.trim() || !form.poste.trim()}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

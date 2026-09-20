import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { ACTIVITE_LABEL, DEPENSE_CATEGORIE_LABEL } from './statusMaps.js';

const EMPTY_FORM = { compte_id: '', budget_id: '', categorie: 'fonctionnement', activite: '', libelle: '', montant: '0', reference: '' };

export default function Depenses() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comptes, setComptes] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('finance', 'create');

  const load = () => get('/finance/depenses').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    get('/finance/comptes?is_active=true').then(setComptes).catch(() => {});
    get('/finance/budgets?statut=actif').then(setBudgets).catch(() => {});
  }, []);

  const submit = async () => {
    try {
      await post('/finance/depenses', { ...form, budget_id: form.budget_id || null, montant: Number(form.montant) });
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
    { key: 'compte_libelle', label: 'Compte', render: (r) => `${r.compte_code} — ${r.compte_libelle}` },
    { key: 'categorie', label: 'Catégorie', render: (r) => DEPENSE_CATEGORIE_LABEL[r.categorie] || r.categorie },
    { key: 'activite', label: 'Activité (directe)', render: (r) => (r.activite ? ACTIVITE_LABEL[r.activite] : '—') },
    { key: 'libelle', label: 'Libellé' },
    { key: 'date_depense', label: 'Date', render: (r) => new Date(r.date_depense).toLocaleDateString('fr-FR') },
    { key: 'montant', label: 'Montant', render: (r) => Number(r.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} dépense(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle dépense
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucune dépense enregistrée." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle dépense">
        <div className="space-y-3">
          <div>
            <label className="label">Compte</label>
            <select className="input" value={form.compte_id} onChange={(e) => setForm({ ...form, compte_id: e.target.value })}>
              <option value="">Sélectionner…</option>
              {comptes.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.libelle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Catégorie</label>
            <select className="input" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
              {Object.entries(DEPENSE_CATEGORIE_LABEL).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Libellé</label>
            <input className="input" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </div>
          <div>
            <label className="label">Activité (si charge directe — optionnel)</label>
            <select className="input" value={form.activite} onChange={(e) => setForm({ ...form, activite: e.target.value })}>
              <option value="">— Frais général non affecté —</option>
              {Object.entries(ACTIVITE_LABEL).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Budget lié (optionnel)</label>
            <select className="input" value={form.budget_id} onChange={(e) => setForm({ ...form, budget_id: e.target.value })}>
              <option value="">— Aucun —</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>{b.numero} — {b.libelle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Montant</label>
            <input className="input" type="number" min="0" step="0.01" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
          </div>
          <div>
            <label className="label">Référence</label>
            <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.compte_id || !form.libelle.trim() || Number(form.montant) <= 0}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

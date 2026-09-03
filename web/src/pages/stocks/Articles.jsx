import { useEffect, useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import { get, post, patch } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import CategoriesManager from './CategoriesManager.jsx';
import { STOCK_ETAT } from './statusMaps.js';

const EMPTY_FORM = { reference: '', designation: '', categorie_id: '', unite: 'unité', seuil_alerte: '0' };
const ACTIVE_MAP = {
  true: { label: 'Actif', className: 'bg-emerald-50 text-emerald-700' },
  false: { label: 'Inactif', className: 'bg-slate-100 text-slate-500' },
};

export default function Articles() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('stocks', 'create');
  const canUpdate = can('stocks', 'update');

  const load = () => get('/stocks/articles').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  const loadCategories = () => get('/stocks/categories').then(setCategories).catch(() => {});

  useEffect(() => { load(); loadCategories(); }, []);

  const submit = async () => {
    try {
      await post('/stocks/articles', { ...form, categorie_id: form.categorie_id || null });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggle = async (a) => {
    try {
      await patch(`/stocks/articles/${a.id}/statut`, { is_active: !a.is_active });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'reference', label: 'Référence', render: (a) => a.reference || '—' },
    { key: 'designation', label: 'Désignation' },
    { key: 'categorie_nom', label: 'Catégorie', render: (a) => a.categorie_nom || '—' },
    { key: 'unite', label: 'Unité' },
    {
      key: 'quantite_stock',
      label: 'Stock',
      render: (a) => (
        <span className={Number(a.quantite_stock) <= Number(a.seuil_alerte) && Number(a.seuil_alerte) > 0 ? 'font-semibold text-hq-orange-dark' : 'font-medium text-slate-700'}>
          {Number(a.quantite_stock).toLocaleString('fr-FR')}
        </span>
      ),
    },
    { key: 'seuil_alerte', label: 'Seuil', render: (a) => Number(a.seuil_alerte).toLocaleString('fr-FR') },
    {
      key: 'etat',
      label: 'État',
      render: (a) => (
        <StatusBadge status={Number(a.quantite_stock) <= Number(a.seuil_alerte) && Number(a.seuil_alerte) > 0 ? 'alerte' : 'ok'} map={STOCK_ETAT} />
      ),
    },
    { key: 'is_active', label: 'Statut', render: (a) => <StatusBadge status={String(a.is_active)} map={ACTIVE_MAP} /> },
    ...(canUpdate
      ? [{
          key: 'actions',
          label: '',
          render: (a) => (
            <button className="text-xs text-hq-blue hover:underline" onClick={() => toggle(a)}>
              {a.is_active ? 'Désactiver' : 'Activer'}
            </button>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{rows.length} article(s)</p>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setCategoriesOpen(true)}>
            <Tag size={16} /> Gérer les catégories
          </button>
          {canCreate && (
            <button className="btn-primary" onClick={() => setOpen(true)}>
              <Plus size={18} /> Nouvel article
            </button>
          )}
        </div>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucun article enregistré." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvel article">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Référence (SKU)</label>
              <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div>
              <label className="label">Unité</label>
              <input className="input" value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Désignation</label>
            <input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          </div>
          <div>
            <label className="label">Catégorie</label>
            <div className="flex gap-2">
              <select className="input" value={form.categorie_id} onChange={(e) => setForm({ ...form, categorie_id: e.target.value })}>
                <option value="">Aucune</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
              <button type="button" className="btn-ghost shrink-0" onClick={() => setCategoriesOpen(true)}>
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div>
            <label className="label">Seuil d'alerte (réapprovisionnement)</label>
            <input className="input" type="number" min="0" step="0.01" value={form.seuil_alerte} onChange={(e) => setForm({ ...form, seuil_alerte: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.designation.trim()}>Enregistrer</button>
        </div>
      </SlideOver>

      <CategoriesManager
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        categories={categories}
        onChanged={loadCategories}
      />
    </div>
  );
}

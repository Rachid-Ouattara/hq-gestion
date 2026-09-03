import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { INVENTAIRE_STATUT } from './statusMaps.js';

export default function Inventaires() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [dateInventaire, setDateInventaire] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [observations, setObservations] = useState('');

  const canCreate = can('stocks', 'create');

  const load = () => get('/stocks/inventaires').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => { get('/stocks/categories').then(setCategories).catch(() => {}); }, []);

  const resetForm = () => {
    setDateInventaire('');
    setCategorieId('');
    setObservations('');
  };

  const submit = async () => {
    try {
      const created = await post('/stocks/inventaires', {
        date_inventaire: dateInventaire || undefined,
        categorie_id: categorieId || null,
        observations,
      });
      resetForm();
      setOpen(false);
      navigate(`${created.id}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'date_inventaire', label: 'Date', render: (i) => new Date(i.date_inventaire).toLocaleDateString('fr-FR') },
    { key: 'nb_lignes', label: 'Articles' },
    { key: 'statut', label: 'Statut', render: (i) => <StatusBadge status={i.statut} map={INVENTAIRE_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} inventaire(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvel inventaire
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucun inventaire." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvel inventaire">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Un inventaire capture la quantité théorique actuelle de tous les articles actifs (ou d'une catégorie), à comparer au comptage physique.
          </p>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={dateInventaire} onChange={(e) => setDateInventaire(e.target.value)} />
          </div>
          <div>
            <label className="label">Catégorie (optionnel — sinon tous les articles actifs)</label>
            <select className="input" value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
              <option value="">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Observations</label>
            <textarea className="input" rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />
          </div>
          <button className="btn-primary w-full" onClick={submit}>Créer et commencer le comptage</button>
        </div>
      </SlideOver>
    </div>
  );
}

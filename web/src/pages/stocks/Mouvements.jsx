import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { MOUVEMENT_MOTIF_LABEL } from './statusMaps.js';

const LABELS = {
  entree: { title: 'Entrées en stock', action: 'Nouvelle entrée', motifPlaceholder: 'Ex. Réception fournisseur, retour client…' },
  sortie: { title: 'Sorties en stock', action: 'Nouvelle sortie', motifPlaceholder: 'Ex. Sortie interne, vente, casse…' },
};

export default function Mouvements({ type }) {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState([]);
  const [open, setOpen] = useState(false);
  const [articleId, setArticleId] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [motif, setMotif] = useState('');
  const [observations, setObservations] = useState('');

  const canCreate = can('stocks', 'create');
  const labels = LABELS[type];

  const load = () => get(`/stocks/mouvements?type=${type}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, [type]);

  useEffect(() => {
    get('/stocks/articles?is_active=true').then(setArticles).catch(() => {});
  }, []);

  const resetForm = () => {
    setArticleId('');
    setQuantite('1');
    setMotif('');
    setObservations('');
  };

  const submit = async () => {
    try {
      await post('/stocks/mouvements', { article_id: articleId, type, quantite: Number(quantite), motif, observations });
      resetForm();
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'article_designation', label: 'Article' },
    { key: 'quantite', label: 'Quantité', render: (m) => `${Number(m.quantite).toLocaleString('fr-FR')} ${m.article_unite}` },
    { key: 'quantite_apres', label: 'Solde après', render: (m) => Number(m.quantite_apres).toLocaleString('fr-FR') },
    { key: 'motif', label: 'Motif', render: (m) => MOUVEMENT_MOTIF_LABEL[m.motif] || m.motif },
    { key: 'created_at', label: 'Date', render: (m) => new Date(m.created_at).toLocaleString('fr-FR') },
    { key: 'effectue_par_nom', label: 'Par', render: (m) => m.effectue_par_nom || '—' },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} mouvement(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> {labels.action}
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucun mouvement enregistré." />

      <SlideOver open={open} onClose={() => { setOpen(false); resetForm(); }} title={labels.action}>
        <div className="space-y-3">
          <div>
            <label className="label">Article</label>
            <select className="input" value={articleId} onChange={(e) => setArticleId(e.target.value)}>
              <option value="">Sélectionner…</option>
              {articles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.reference ? `${a.reference} — ` : ''}{a.designation} (stock : {Number(a.quantite_stock).toLocaleString('fr-FR')} {a.unite})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quantité</label>
            <input className="input" type="number" min="0" step="0.01" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
          </div>
          <div>
            <label className="label">Motif</label>
            <input className="input" placeholder={labels.motifPlaceholder} value={motif} onChange={(e) => setMotif(e.target.value)} />
          </div>
          <div>
            <label className="label">Observations</label>
            <textarea className="input" rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!articleId || !motif.trim() || Number(quantite) <= 0}>
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

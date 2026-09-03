import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import SlideOver from '../../components/SlideOver.jsx';

export default function Receptions() {
  const { can } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bonsReceptionnables, setBonsReceptionnables] = useState([]);
  const [stockArticles, setStockArticles] = useState([]);
  const [open, setOpen] = useState(false);
  const [bonId, setBonId] = useState('');
  const [bonDetail, setBonDetail] = useState(null);
  const [type, setType] = useState('complete');
  const [observations, setObservations] = useState('');
  const [lignes, setLignes] = useState([]);

  const canCreate = can('achats', 'create');
  const bonIdFilter = searchParams.get('bon_id');

  const load = () => {
    const qs = bonIdFilter ? `?bon_id=${bonIdFilter}` : '';
    get(`/achats/receptions${qs}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [bonIdFilter]);

  useEffect(() => {
    get('/achats/bons-de-commande').then((all) => {
      setBonsReceptionnables(all.filter((b) => ['envoyee', 'receptionnee_partielle'].includes(b.statut)));
    }).catch(() => {});
    get('/stocks/articles?is_active=true').then(setStockArticles).catch(() => {});
  }, []);

  const selectBon = async (id) => {
    setBonId(id);
    setBonDetail(null);
    setLignes([]);
    if (!id) return;
    const detail = await get(`/achats/bons-de-commande/${id}`).catch(() => null);
    if (!detail) return;
    setBonDetail(detail);
    setLignes(
      detail.lignes
        .filter((l) => Number(l.quantite_recue) < Number(l.quantite))
        .map((l) => ({
          bon_ligne_id: l.id,
          designation: l.designation,
          restant: Number(l.quantite) - Number(l.quantite_recue),
          quantite_recue: String(Number(l.quantite) - Number(l.quantite_recue)),
          etat: 'conforme',
          article_id: '',
        }))
    );
  };

  useEffect(() => {
    if (bonIdFilter) {
      selectBon(bonIdFilter);
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setBonId('');
    setBonDetail(null);
    setLignes([]);
    setType('complete');
    setObservations('');
  };

  const updateLigne = (i, field, value) => {
    setLignes((ls) => ls.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  };

  const submit = async () => {
    try {
      const payload = {
        bon_id: bonId,
        type,
        observations,
        lignes: lignes
          .filter((l) => Number(l.quantite_recue) > 0)
          .map((l) => ({ bon_ligne_id: l.bon_ligne_id, quantite_recue: Number(l.quantite_recue), etat: l.etat, article_id: l.article_id || null })),
      };
      if (payload.lignes.length === 0) throw new Error('Indiquez au moins une quantité reçue');
      await post('/achats/receptions', payload);
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
    { key: 'bon_numero', label: 'Bon de commande' },
    { key: 'date_reception', label: 'Date', render: (r) => new Date(r.date_reception).toLocaleDateString('fr-FR') },
    { key: 'type', label: 'Type', render: (r) => (r.type === 'complete' ? 'Complète' : 'Partielle') },
    { key: 'receptionne_par_nom', label: 'Réceptionné par', render: (r) => r.receptionne_par_nom || '—' },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} réception(s){bonIdFilter ? ' pour ce bon' : ''}</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle réception
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucune réception enregistrée." />

      <SlideOver open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouvelle réception" widthClass="max-w-3xl">
        <div className="space-y-3">
          <div>
            <label className="label">Bon de commande</label>
            <select className="input" value={bonId} onChange={(e) => selectBon(e.target.value)}>
              <option value="">Sélectionner…</option>
              {bonsReceptionnables.map((b) => (
                <option key={b.id} value={b.id}>{b.numero} — {b.fournisseur_nom}</option>
              ))}
            </select>
          </div>

          {bonDetail && (
            <>
              <div>
                <label className="label">Type</label>
                <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="complete">Complète</option>
                  <option value="partielle">Partielle</option>
                </select>
              </div>

              {lignes.length === 0 ? (
                <p className="text-sm text-slate-400">Toutes les lignes de ce bon sont déjà entièrement reçues.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Désignation</th>
                        <th className="px-3 py-2">Restant</th>
                        <th className="px-3 py-2">Qté reçue</th>
                        <th className="px-3 py-2">État</th>
                        <th className="px-3 py-2">Article de stock (optionnel)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lignes.map((l, i) => (
                        <tr key={l.bon_ligne_id}>
                          <td className="px-3 py-1.5">{l.designation}</td>
                          <td className="px-3 py-1.5 text-slate-400">{l.restant}</td>
                          <td className="w-24 px-2 py-1.5">
                            <input
                              className="input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.quantite_recue}
                              onChange={(e) => updateLigne(i, 'quantite_recue', e.target.value)}
                            />
                          </td>
                          <td className="w-32 px-2 py-1.5">
                            <select className="input" value={l.etat} onChange={(e) => updateLigne(i, 'etat', e.target.value)}>
                              <option value="conforme">Conforme</option>
                              <option value="endommage">Endommagé</option>
                              <option value="manquant">Manquant</option>
                            </select>
                          </td>
                          <td className="w-48 px-2 py-1.5">
                            <select
                              className="input"
                              value={l.article_id}
                              disabled={l.etat !== 'conforme'}
                              onChange={(e) => updateLigne(i, 'article_id', e.target.value)}
                              title={l.etat !== 'conforme' ? "Disponible uniquement pour les lignes à l'état conforme" : undefined}
                            >
                              <option value="">— Aucun —</option>
                              {stockArticles.map((a) => (
                                <option key={a.id} value={a.id}>{a.reference ? `${a.reference} — ` : ''}{a.designation}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <label className="label">Observations</label>
                <textarea className="input" rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />
              </div>

              <button className="btn-primary w-full" onClick={submit} disabled={lignes.length === 0}>
                Enregistrer la réception
              </button>
            </>
          )}
        </div>
      </SlideOver>
    </div>
  );
}

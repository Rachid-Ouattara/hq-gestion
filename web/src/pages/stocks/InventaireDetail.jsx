import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Save } from 'lucide-react';
import { get, patch, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { INVENTAIRE_STATUT } from './statusMaps.js';

export default function InventaireDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [inventaire, setInventaire] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canUpdate = can('stocks', 'update');

  const load = useCallback(() => {
    get(`/stocks/inventaires/${id}`).then((data) => {
      setInventaire(data);
      setLignes(data.lignes.map((l) => ({ ...l, quantite_comptee: l.quantite_comptee ?? '' })));
    }).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updateLigne = (i, value) => {
    setLignes((ls) => ls.map((l, idx) => (idx === i ? { ...l, quantite_comptee: value } : l)));
  };

  const enregistrer = async () => {
    setSaving(true);
    try {
      const payload = {
        lignes: lignes
          .filter((l) => l.quantite_comptee !== '')
          .map((l) => ({ id: l.id, quantite_comptee: Number(l.quantite_comptee) })),
      };
      await patch(`/stocks/inventaires/${id}/lignes`, payload);
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const cloturer = async () => {
    if (!window.confirm('Clôturer cet inventaire ? Les écarts créeront des mouvements de stock automatiques et l\'inventaire deviendra en lecture seule.')) return;
    try {
      await post(`/stocks/inventaires/${id}/cloturer`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!inventaire) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  const enCours = inventaire.statut === 'en_cours';
  const toutesComptees = lignes.every((l) => l.quantite_comptee !== '');

  return (
    <div>
      <button onClick={() => navigate('/modules/stocks/inventaires')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux inventaires
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{inventaire.numero}</h1>
            <StatusBadge status={inventaire.statut} map={INVENTAIRE_STATUT} />
          </div>
          <p className="text-sm text-slate-500">{new Date(inventaire.date_inventaire).toLocaleDateString('fr-FR')}{inventaire.observations ? ` · ${inventaire.observations}` : ''}</p>
        </div>
        {enCours && canUpdate && (
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={enregistrer} disabled={saving}>
              <Save size={16} /> Enregistrer le comptage
            </button>
            <button className="btn-primary" onClick={cloturer} disabled={!toutesComptees}>
              <CheckCircle2 size={16} /> Clôturer
            </button>
          </div>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {enCours && !toutesComptees && (
        <p className="mb-4 rounded-lg bg-hq-blue-light px-3 py-2 text-sm text-hq-blue">
          Saisissez une quantité comptée pour chaque article avant de pouvoir clôturer.
        </p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Article</th>
              <th className="px-4 py-3">Théorique</th>
              <th className="px-4 py-3">Comptée</th>
              <th className="px-4 py-3">Écart</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lignes.map((l, i) => {
              const ecart = l.quantite_comptee !== '' ? Number(l.quantite_comptee) - Number(l.quantite_theorique) : null;
              return (
                <tr key={l.id}>
                  <td className="px-4 py-2 text-slate-700">
                    {l.article_reference ? `${l.article_reference} — ` : ''}{l.article_designation}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{Number(l.quantite_theorique).toLocaleString('fr-FR')} {l.article_unite}</td>
                  <td className="w-32 px-4 py-2">
                    {enCours ? (
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.quantite_comptee}
                        onChange={(e) => updateLigne(i, e.target.value)}
                      />
                    ) : (
                      <span>{l.quantite_comptee !== '' ? Number(l.quantite_comptee).toLocaleString('fr-FR') : '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {ecart === null ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className={ecart === 0 ? 'text-slate-500' : ecart > 0 ? 'text-emerald-600' : 'text-hq-orange-dark'}>
                        {ecart > 0 ? '+' : ''}{ecart.toLocaleString('fr-FR')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lignes.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">Aucun article dans cet inventaire.</p>}
      </div>
    </div>
  );
}

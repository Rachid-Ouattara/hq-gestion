import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Send, ShoppingCart, XCircle } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { DEMANDE_STATUS } from './statusMaps.js';

export default function DemandeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [demande, setDemande] = useState(null);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');

  const canSubmit = can('achats', 'create');
  const canDecide = can('achats', 'validate');

  const load = useCallback(() => {
    get(`/achats/demandes/${id}`).then(setDemande).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const soumettre = async () => {
    try {
      await post(`/achats/demandes/${id}/soumettre`, {});
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const decider = async (decision) => {
    try {
      await post(`/achats/demandes/${id}/decider`, { decision, comment });
      setComment('');
      toast.success(decision === 'validated' ? 'Validé' : 'Rejeté');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const creerBon = () => navigate(`/modules/achats/bons?demande_id=${id}`);

  if (!demande) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/achats/demandes')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux demandes
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{demande.numero}</h1>
            <StatusBadge status={demande.statut} map={DEMANDE_STATUS} />
          </div>
          <p className="text-sm text-slate-500">{demande.objet}</p>
        </div>
        <div className="flex gap-2">
          {demande.statut === 'brouillon' && canSubmit && (
            <button className="btn-accent" onClick={soumettre}>
              <Send size={16} /> Soumettre à validation
            </button>
          )}
          {demande.statut === 'validee' && canSubmit && (
            <button className="btn-primary" onClick={creerBon}>
              <ShoppingCart size={16} /> Créer un bon de commande
            </button>
          )}
        </div>
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Articles / services</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-2">Désignation</th>
                <th className="py-2">Qté</th>
                <th className="py-2">Unité</th>
                <th className="py-2">Prix estimé</th>
                <th className="py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {demande.lignes.map((l) => (
                <tr key={l.id}>
                  <td className="py-2">{l.designation}</td>
                  <td className="py-2">{l.quantite}</td>
                  <td className="py-2">{l.unite || '—'}</td>
                  <td className="py-2">{Number(l.prix_estime_unitaire).toLocaleString('fr-FR')}</td>
                  <td className="py-2 text-right">{Number(l.montant_estime).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-right text-sm font-semibold text-slate-700">
            Total estimé : {Number(demande.montant_estime).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
          </p>

          {demande.justification && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Justification</h3>
              <p className="text-sm text-slate-600">{demande.justification}</p>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Suivi</h2>
          <p className="text-sm text-slate-600">Demandeur : {demande.demandeur_nom || '—'}</p>
          {demande.validation && (
            <p className="mt-1 text-xs text-slate-400">
              Soumise le {new Date(demande.validation.requested_at).toLocaleDateString('fr-FR')}
            </p>
          )}

          {demande.statut === 'soumise' && canDecide && (
            <div className="mt-4 space-y-2">
              <label className="label">Commentaire (optionnel)</label>
              <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn flex-1 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => decider('validated')}>
                  <CheckCircle2 size={16} /> Valider
                </button>
                <button className="btn flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50" onClick={() => decider('rejected')}>
                  <XCircle size={16} /> Rejeter
                </button>
              </div>
            </div>
          )}

          {demande.validation?.comment && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Commentaire de la Direction</p>
              <p className="mt-1 text-sm text-slate-600">{demande.validation.comment}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

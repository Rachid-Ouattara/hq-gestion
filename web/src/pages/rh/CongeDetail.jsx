import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Send, XCircle } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { CONGE_STATUT, TYPE_CONGE_LABEL } from './statusMaps.js';

export default function CongeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [conge, setConge] = useState(null);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');

  const canSubmit = can('rh', 'create');
  const canDecide = can('rh', 'validate');

  const load = useCallback(() => {
    get(`/rh/conges/${id}`).then(setConge).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const soumettre = async () => {
    try {
      await post(`/rh/conges/${id}/soumettre`, {});
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const decider = async (decision) => {
    try {
      await post(`/rh/conges/${id}/decider`, { decision, comment });
      setComment('');
      toast.success(decision === 'validated' ? 'Validé' : 'Rejeté');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!conge) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/rh/conges')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux congés
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{conge.numero}</h1>
            <StatusBadge status={conge.statut} map={CONGE_STATUT} />
          </div>
          <p className="text-sm text-slate-500">{conge.employe_nom} {conge.employe_prenom} — {TYPE_CONGE_LABEL[conge.type_conge]}</p>
        </div>
        {conge.statut === 'brouillon' && canSubmit && (
          <button className="btn-accent" onClick={soumettre}>
            <Send size={16} /> Soumettre à validation
          </button>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Détails</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-400">Du</dt>
              <dd className="text-slate-700">{new Date(conge.date_debut).toLocaleDateString('fr-FR')}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Au</dt>
              <dd className="text-slate-700">{new Date(conge.date_fin).toLocaleDateString('fr-FR')}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Nombre de jours</dt>
              <dd className="text-slate-700">{conge.nombre_jours}</dd>
            </div>
          </dl>
          {conge.motif && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Motif</h3>
              <p className="text-sm text-slate-600">{conge.motif}</p>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Suivi</h2>
          {conge.validation && (
            <p className="text-xs text-slate-400">
              Soumise le {new Date(conge.validation.requested_at).toLocaleDateString('fr-FR')}
            </p>
          )}

          {conge.statut === 'soumise' && canDecide && (
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

          {conge.validation?.comment && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Commentaire de la Direction</p>
              <p className="mt-1 text-sm text-slate-600">{conge.validation.comment}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Send, ChevronRight } from 'lucide-react';
import { get, post } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { moduleIcon } from '../lib/moduleIcons.js';
import DetailSkeleton from '../components/DetailSkeleton.jsx';

export default function ModulePage() {
  const { code } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const [module, setModule] = useState(null);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState('');

  const canValidate = can(code, 'validate');
  const canCreate = can(code, 'create');
  const Icon = moduleIcon(module?.icon);

  const loadPending = useCallback(() => {
    if (canValidate) get(`/modules/${code}/validations`).then(setPending).catch(() => {});
  }, [code, canValidate]);

  useEffect(() => {
    setModule(null);
    setPending([]);
    get(`/modules/${code}`).then(setModule).catch((e) => setError(e.message));
    loadPending();
  }, [code, loadPending]);

  const submitDemo = async () => {
    try {
      await post(`/modules/${code}/submit`, {
        entity_type: 'exemple',
        entity_id: `DEMO-${Date.now().toString().slice(-5)}`,
      });
      toast.success('Enregistré');
      loadPending();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const decide = async (id, decision) => {
    try {
      await post(`/validations/${id}/decide`, { decision });
      toast.success(decision === 'validated' ? 'Validé' : 'Rejeté');
      loadPending();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!module) {
    return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;
  }

  return (
    <div>
      <header className="mb-6 flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-xl" style={{ backgroundColor: module.color }}>
          <Icon size={24} className="text-white" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-hq-blue">{module.name}</h1>
          <p className="text-sm text-slate-500">Module opérationnel</p>
        </div>
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Fonctionnalités
          </h2>
          <ul className="divide-y divide-slate-100">
            {module.features.map((f) => (
              <li key={f} className="flex items-center justify-between py-3">
                <span className="text-sm text-slate-700">{f}</span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  À implémenter <ChevronRight size={14} />
                </span>
              </li>
            ))}
          </ul>
          {canCreate && (
            <button className="btn-ghost mt-4" onClick={submitDemo}>
              <Send size={16} /> Soumettre un exemple à validation
            </button>
          )}
        </section>

        {canValidate && (
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              À valider ({pending.length})
            </h2>
            {pending.length === 0 && <p className="text-sm text-slate-400">Aucune demande en attente.</p>}
            <ul className="space-y-3">
              {pending.map((v) => (
                <li key={v.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-700">{v.entity_type} · {v.entity_id}</p>
                  <p className="mb-2 text-xs text-slate-400">par {v.requested_by_name}</p>
                  <div className="flex gap-2">
                    <button
                      className="btn flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => decide(v.id, 'validated')}
                    >
                      <CheckCircle2 size={16} /> Valider
                    </button>
                    <button
                      className="btn flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50"
                      onClick={() => decide(v.id, 'rejected')}
                    >
                      <XCircle size={16} /> Rejeter
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

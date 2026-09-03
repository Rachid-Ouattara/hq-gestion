import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { BUDGET_STATUS, DEPENSE_CATEGORIE_LABEL } from './statusMaps.js';

export default function BudgetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [budget, setBudget] = useState(null);
  const [error, setError] = useState('');

  const canUpdate = can('finance', 'update');

  const load = useCallback(() => {
    get(`/finance/budgets/${id}`).then(setBudget).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const cloturer = async () => {
    if (!window.confirm('Clôturer ce budget ?')) return;
    try {
      await post(`/finance/budgets/${id}/cloturer`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!budget) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  const taux = Math.min(budget.taux_consommation, 1);

  return (
    <div>
      <button onClick={() => navigate('/modules/finance/budgets')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux budgets
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{budget.numero} — {budget.libelle}</h1>
            <StatusBadge status={budget.statut} map={BUDGET_STATUS} />
          </div>
          <p className="text-sm text-slate-500">Exercice {budget.exercice}{budget.departement ? ` · ${budget.departement}` : ''}</p>
        </div>
        {budget.statut === 'actif' && canUpdate && (
          <button className="btn-ghost" onClick={cloturer}><Lock size={16} /> Clôturer</button>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <section className="card mb-6 p-5">
        <div className="mb-3 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Prévu</p>
            <p className="text-xl font-semibold text-hq-blue">{Number(budget.montant_prevu).toLocaleString('fr-FR')}</p>
          </div>
          <div>
            <p className="text-slate-400">Réalisé</p>
            <p className="text-xl font-semibold text-hq-orange-dark">{Number(budget.montant_realise).toLocaleString('fr-FR')}</p>
          </div>
          <div>
            <p className="text-slate-400">Taux de consommation</p>
            <p className="text-xl font-semibold text-slate-700">{(budget.taux_consommation * 100).toFixed(0)}%</p>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full ${taux >= 1 ? 'bg-red-500' : 'bg-hq-orange'}`}
            style={{ width: `${Math.round(taux * 100)}%` }}
          />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Dépenses imputées</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-2">N°</th>
              <th className="py-2">Libellé</th>
              <th className="py-2">Catégorie</th>
              <th className="py-2">Date</th>
              <th className="py-2 text-right">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {budget.depenses.map((d) => (
              <tr key={d.id}>
                <td className="py-2">{d.numero}</td>
                <td className="py-2">{d.libelle}</td>
                <td className="py-2">{DEPENSE_CATEGORIE_LABEL[d.categorie] || d.categorie}</td>
                <td className="py-2">{new Date(d.date_depense).toLocaleDateString('fr-FR')}</td>
                <td className="py-2 text-right">{Number(d.montant).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {budget.depenses.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Aucune dépense imputée à ce budget.</p>}
      </section>
    </div>
  );
}

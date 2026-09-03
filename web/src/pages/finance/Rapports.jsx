import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { get } from '../../lib/api.js';
import StatCard from '../../components/StatCard.jsx';
import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { COMPTE_TYPE_LABEL } from './statusMaps.js';

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

export default function Rapports() {
  const [annee, setAnnee] = useState(String(currentYear));
  const [synthese, setSynthese] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    get(`/finance/rapports/synthese?annee=${annee}`).then(setSynthese).catch((e) => setError(e.message));
  }, [annee]);

  return (
    <div>
      <div className="mb-4">
        <select className="input max-w-[10rem]" value={annee} onChange={(e) => setAnnee(e.target.value)}>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {!synthese && !error && <DetailSkeleton />}

      {synthese && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Total recettes" value={Number(synthese.total_recettes).toLocaleString('fr-FR')} Icon={TrendingUp} />
            <StatCard label="Total dépenses" value={Number(synthese.total_depenses).toLocaleString('fr-FR')} Icon={TrendingDown} />
            <StatCard label="Solde net" value={Number(synthese.solde_net).toLocaleString('fr-FR')} Icon={Wallet} accent={synthese.solde_net < 0} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Soldes par compte</h2>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-2">Compte</th>
                    <th className="py-2">Type</th>
                    <th className="py-2 text-right">Solde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {synthese.comptes.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2">{c.code} — {c.libelle}</td>
                      <td className="py-2 text-slate-500">{COMPTE_TYPE_LABEL[c.type] || c.type}</td>
                      <td className={`py-2 text-right font-medium ${Number(c.solde) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {Number(c.solde).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {synthese.comptes.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Aucun compte actif.</p>}
            </section>

            <section className="card p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Consommation budgétaire</h2>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-2">Budget</th>
                    <th className="py-2 text-right">Prévu</th>
                    <th className="py-2 text-right">Réalisé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {synthese.budgets.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2">{b.numero} — {b.libelle}</td>
                      <td className="py-2 text-right">{Number(b.montant_prevu).toLocaleString('fr-FR')}</td>
                      <td className="py-2 text-right font-medium text-hq-orange-dark">{Number(b.montant_realise).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {synthese.budgets.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Aucun budget pour cet exercice.</p>}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

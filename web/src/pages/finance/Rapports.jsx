import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { get } from '../../lib/api.js';
import StatCard from '../../components/StatCard.jsx';
import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { ACTIVITE_LABEL, COMPTE_TYPE_LABEL, DEPENSE_CATEGORIE_LABEL } from './statusMaps.js';

function fmt(n) {
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
}

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

          <section className="card mt-6 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Compte de résultat</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">Produits par activité</p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {synthese.resultat.produits_par_activite.map((p) => (
                      <tr key={p.activite}>
                        <td className="py-1.5">{ACTIVITE_LABEL[p.activite] || p.activite}</td>
                        <td className="py-1.5 text-right">{fmt(p.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 font-semibold">
                      <td className="py-1.5">Total produits</td>
                      <td className="py-1.5 text-right">{fmt(synthese.resultat.total_produits)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-500">Charges par nature</p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {synthese.resultat.charges_par_nature.map((c) => (
                      <tr key={c.categorie}>
                        <td className="py-1.5">{DEPENSE_CATEGORIE_LABEL[c.categorie] || c.categorie}</td>
                        <td className="py-1.5 text-right">{fmt(c.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 font-semibold">
                      <td className="py-1.5">Total charges</td>
                      <td className="py-1.5 text-right">{fmt(synthese.resultat.total_charges)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
              <StatCard label="Résultat (produits − charges)" Icon={Wallet} value={fmt(synthese.resultat.resultat)} accent={synthese.resultat.resultat < 0} />
              <StatCard label="Prévisionnel (année)" value={fmt(synthese.resultat.prevu)} />
              <StatCard
                label="Écart réalisé / prévisionnel"
                value={`${fmt(synthese.resultat.ecart)}${synthese.resultat.ecart_pct != null ? ` (${Math.round(synthese.resultat.ecart_pct * 100)}%)` : ''}`}
                accent={synthese.resultat.ecart < 0}
              />
            </div>
          </section>

          <section className="card mt-6 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Analyse par activité</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2">Activité</th>
                  <th className="py-2 text-right">CA</th>
                  <th className="py-2 text-right">Charges directes</th>
                  <th className="py-2 text-right">Marge</th>
                  <th className="py-2">Marge / CA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {synthese.analyse_par_activite.map((a) => {
                  const pct = a.ca > 0 ? Math.max(0, Math.min(100, Math.round((a.marge / a.ca) * 100))) : 0;
                  return (
                    <tr key={a.activite}>
                      <td className="py-2">{ACTIVITE_LABEL[a.activite] || a.activite}</td>
                      <td className="py-2 text-right">{fmt(a.ca)}</td>
                      <td className="py-2 text-right">{fmt(a.charges_directes)}</td>
                      <td className={`py-2 text-right font-medium ${a.marge < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(a.marge)}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-hq-orange" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{a.ca > 0 ? `${Math.round((a.marge / a.ca) * 100)}%` : '—'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {synthese.analyse_par_activite.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Aucune recette pour cet exercice.</p>}
          </section>
        </>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Banknote, Landmark, Smartphone, Wallet } from 'lucide-react';
import { get } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import StatCard from '../../components/StatCard.jsx';
import LineChart from '../../components/charts/LineChart.jsx';
import { TYPE_TRESORERIE_LABEL } from './statusMaps.js';

const TYPE_ICON = { banque: Landmark, caisse: Banknote, mobile_money: Smartphone };
const JOURS_OPTIONS = [30, 60, 90];

function fmt(n) {
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
}

function toISODate(date) {
  return date.toLocaleDateString('sv-SE');
}

export default function Tresorerie() {
  const toast = useToast();
  const [tresorerie, setTresorerie] = useState(null);
  const [mouvements, setMouvements] = useState(null);
  const [previsionnel, setPrevisionnel] = useState(null);
  const [jours, setJours] = useState(30);

  useEffect(() => {
    get('/finance/tresorerie').then(setTresorerie).catch((e) => toast.error(e.message));
    const from = toISODate(new Date(new Date().setDate(new Date().getDate() - 30)));
    get(`/finance/tresorerie/mouvements?from=${from}`).then(setMouvements).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    get(`/finance/tresorerie/previsionnel?jours=${jours}`).then(setPrevisionnel).catch((e) => toast.error(e.message));
  }, [jours, toast]);

  const soldeSeries = useMemo(() => {
    if (!tresorerie || !mouvements) return null;
    const netByDay = new Map();
    for (const m of mouvements) {
      const day = m.date_mouvement.slice(0, 10);
      const delta = m.type === 'encaissement' ? Number(m.montant) : -Number(m.montant);
      netByDay.set(day, (netByDay.get(day) || 0) + delta);
    }
    const netPeriodeTotal = [...netByDay.values()].reduce((a, b) => a + b, 0);
    let running = tresorerie.solde_total - netPeriodeTotal;

    const days = [...new Set(mouvements.map((m) => m.date_mouvement.slice(0, 10)))].sort();
    const points = days.map((d) => {
      running += netByDay.get(d) || 0;
      return { x: d, y: running };
    });
    return [{ key: 'solde', label: 'Solde trésorerie', color: '#2a9d8f', points }];
  }, [tresorerie, mouvements]);

  if (!tresorerie) return null;

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {['banque', 'caisse', 'mobile_money'].map((type) => {
          const Icon = TYPE_ICON[type];
          return (
            <StatCard key={type} label={TYPE_TRESORERIE_LABEL[type]} Icon={Icon} value={fmt(tresorerie.solde_par_type[type] || 0)} />
          );
        })}
      </div>

      <section className="card mb-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Comptes de trésorerie</h2>
          <p className="text-sm font-semibold text-hq-blue">Total : {fmt(tresorerie.solde_total)}</p>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-2">Compte</th>
              <th className="py-2">Type</th>
              <th className="py-2 text-right">Solde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tresorerie.comptes.map((c) => (
              <tr key={c.id}>
                <td className="py-2">{c.code} — {c.libelle}</td>
                <td className="py-2 text-slate-500">{TYPE_TRESORERIE_LABEL[c.type_tresorerie]}</td>
                <td className="py-2 text-right font-medium">{fmt(c.solde)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tresorerie.comptes.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">
            Aucun compte de trésorerie. Ajoutez un type (Banque/Caisse/Mobile Money) à un compte depuis Comptabilité générale.
          </p>
        )}
      </section>

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Évolution du solde (30 derniers jours)</h2>
        {soldeSeries ? <LineChart series={soldeSeries} formatValue={(v) => fmt(v)} /> : <p className="text-sm text-slate-400">Chargement…</p>}
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Prévisionnel de trésorerie</h2>
          <div className="flex gap-1 rounded-lg border border-slate-300 p-0.5">
            {JOURS_OPTIONS.map((j) => (
              <button
                key={j}
                onClick={() => setJours(j)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${jours === j ? 'bg-hq-blue text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {j}j
              </button>
            ))}
          </div>
        </div>
        {previsionnel && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard label="Solde actuel" Icon={Wallet} value={fmt(previsionnel.solde_actuel)} />
            <StatCard label={`Créances à échoir (${jours}j)`} value={`+ ${fmt(previsionnel.creances_a_echoir)}`} />
            <StatCard label={`Dettes à échoir (${jours}j)`} value={`- ${fmt(previsionnel.dettes_a_echoir)}`} />
            <StatCard
              label="Solde prévisionnel"
              value={fmt(previsionnel.solde_previsionnel)}
              accent={previsionnel.solde_previsionnel < 0}
            />
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Calculé à partir des échéances déjà connues des factures et bons de commande non soldés — ne modélise pas les charges récurrentes futures.
        </p>
      </section>
    </div>
  );
}

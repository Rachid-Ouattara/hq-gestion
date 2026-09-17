import { useEffect, useState } from 'react';
import { Users, Clock, CheckCircle2, Activity } from 'lucide-react';
import { get } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import StatCard from '../../components/StatCard.jsx';
import LineChart from '../../components/charts/LineChart.jsx';
import BarChart from '../../components/charts/BarChart.jsx';

const KPI_META = [
  { key: 'utilisateurs_actifs', label: 'Utilisateurs actifs', Icon: Users },
  { key: 'validations_en_attente', label: 'Validations en attente', Icon: Clock },
  { key: 'validations_traitees', label: 'Validations traitées', Icon: CheckCircle2 },
  { key: 'actions_7j', label: 'Actions (7 jours)', Icon: Activity },
];

const MODULE_LABEL = {
  administrative: 'Administratif',
  rh: 'Ressources Humaines',
  achats: 'Achats',
  stocks: 'Stocks',
  finance: 'Finance',
  commercial: 'Commercial',
  formation: 'Formation',
  prospection: 'Prospection',
};
const MODULE_COLOR = {
  administrative: '#2456a6',
  rh: '#4a9d5b',
  achats: '#7b4b9e',
  stocks: '#e8823a',
  finance: '#2a9d8f',
  commercial: '#3a7bd5',
  formation: '#d1495b',
  prospection: '#b8860b',
};
const MODULE_ORDER = ['administrative', 'rh', 'achats', 'stocks', 'finance', 'commercial', 'formation', 'prospection'];
const SYSTEME_COLOR = '#94A3B8';

const WINDOWS = [
  { value: 7, label: '7 jours' },
  { value: 30, label: '30 jours' },
  { value: 90, label: '90 jours' },
];

const fmtMontant = (v) => `${Math.round(v).toLocaleString('fr-FR')} FCFA`;
const fmtCount = (v) => v.toLocaleString('fr-FR');

function toPoints(rows, valueKey = 'n') {
  return rows.map((r) => ({ x: r.jour.slice(0, 10), y: Number(r[valueKey]) }));
}

/** Reconstruit une série de barres empilées « activité par module » à partir des
 * lignes (jour, module_code, n) renvoyées par /reporting/tendances. */
function buildActivityBars(rows) {
  const byDay = new Map();
  for (const r of rows) {
    const day = r.jour.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, new Map());
    const code = r.module_code || 'systeme';
    byDay.get(day).set(code, (byDay.get(day).get(code) || 0) + r.n);
  }
  const days = [...byDay.keys()].sort();
  return days.map((day) => ({
    x: day,
    segments: [
      ...MODULE_ORDER.filter((code) => byDay.get(day).has(code)).map((code) => ({
        key: code,
        label: MODULE_LABEL[code],
        color: MODULE_COLOR[code],
        value: byDay.get(day).get(code),
      })),
      ...(byDay.get(day).has('systeme')
        ? [{ key: 'systeme', label: 'Connexions', color: SYSTEME_COLOR, value: byDay.get(day).get('systeme') }]
        : []),
    ],
  }));
}

export default function ReportingApercu() {
  const toast = useToast();
  const [kpi, setKpi] = useState(null);
  const [jours, setJours] = useState(30);
  const [tendances, setTendances] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get('/reporting/kpi').then(setKpi).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    get(`/reporting/tendances?jours=${jours}`)
      .then(setTendances)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jours]);

  return (
    <div>
      {kpi && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KPI_META.map(({ key, label, Icon }) => (
            <StatCard key={key} label={label} value={kpi[key]} Icon={Icon} accent={key === 'validations_en_attente'} />
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Tendances</h2>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              onClick={() => setJours(w.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                jours === w.value ? 'bg-hq-blue text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-4 lg:grid-cols-2 ${loading ? 'opacity-60' : ''}`}>
        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Activité par module</h3>
          {tendances && (
            <BarChart
              data={buildActivityBars(tendances.activite_par_module)}
              formatValue={fmtCount}
              emptyLabel="Aucune activité enregistrée sur cette période."
            />
          )}
        </section>

        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Recettes &amp; dépenses</h3>
          {tendances && (
            <LineChart
              series={[
                { key: 'recettes', label: 'Recettes', color: '#2a9d8f', points: toPoints(tendances.finances.recettes, 'total') },
                { key: 'depenses', label: 'Dépenses', color: '#F5931D', points: toPoints(tendances.finances.depenses, 'total') },
              ]}
              formatValue={fmtMontant}
            />
          )}
        </section>

        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Devis créés &amp; acceptés</h3>
          {tendances && (
            <LineChart
              series={[
                { key: 'crees', label: 'Créés', color: '#3a7bd5', points: toPoints(tendances.commercial.devis_crees) },
                { key: 'acceptes', label: 'Acceptés', color: '#2a9d8f', points: toPoints(tendances.commercial.devis_acceptes) },
              ]}
              formatValue={fmtCount}
            />
          )}
        </section>

        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Chiffre d'affaires facturé</h3>
          {tendances && (
            <LineChart
              series={[{ key: 'ca', label: 'CA facturé', color: '#3a7bd5', points: toPoints(tendances.commercial.chiffre_affaires_facture, 'total') }]}
              formatValue={fmtMontant}
            />
          )}
        </section>

        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Congés &amp; candidatures</h3>
          {tendances && (
            <LineChart
              series={[
                { key: 'conges', label: 'Congés soumis', color: '#4a9d5b', points: toPoints(tendances.rh.conges) },
                { key: 'candidats', label: 'Candidatures reçues', color: '#7b4b9e', points: toPoints(tendances.rh.candidats) },
              ]}
              formatValue={fmtCount}
            />
          )}
        </section>

        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Montant commandé (Achats)</h3>
          {tendances && (
            <LineChart
              series={[{ key: 'commande', label: 'Montant commandé', color: '#7b4b9e', points: toPoints(tendances.achats.montant_commande, 'total') }]}
              formatValue={fmtMontant}
            />
          )}
        </section>
      </div>
    </div>
  );
}

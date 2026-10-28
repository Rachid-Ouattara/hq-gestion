import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Banknote, Landmark, Plus, Repeat, Smartphone, Wallet } from 'lucide-react';
import { get, post, patch, del } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatCard from '../../components/StatCard.jsx';
import DataTable from '../../components/DataTable.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import LineChart from '../../components/charts/LineChart.jsx';
import { TYPE_TRESORERIE_LABEL, PERIODICITE_LABEL } from './statusMaps.js';

const TYPE_ICON = { banque: Landmark, caisse: Banknote, mobile_money: Smartphone };
const JOURS_OPTIONS = [30, 60, 90];
const SUB_TABS = [
  { key: 'tresorerie', label: 'Trésorerie' },
  { key: 'charges-recurrentes', label: 'Charges récurrentes' },
];
const EMPTY_CHARGE = { libelle: '', montant: '0', periodicite: 'mensuelle', prochaine_echeance: '' };

function fmt(n) {
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
}

function toISODate(date) {
  return date.toLocaleDateString('sv-SE');
}

function TresorerieOverview() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jours]);

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <StatCard label="Solde actuel" Icon={Wallet} value={fmt(previsionnel.solde_actuel)} />
            <StatCard label={`Créances à échoir (${jours}j)`} value={`+ ${fmt(previsionnel.creances_a_echoir)}`} />
            <StatCard label={`Dettes à échoir (${jours}j)`} value={`- ${fmt(previsionnel.dettes_a_echoir)}`} />
            <StatCard label={`Charges récurrentes (${jours}j)`} Icon={Repeat} value={`- ${fmt(previsionnel.charges_recurrentes_a_echoir)}`} />
            <StatCard
              label="Solde prévisionnel"
              value={fmt(previsionnel.solde_previsionnel)}
              accent={previsionnel.solde_previsionnel < 0}
            />
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Calculé à partir des échéances déjà connues des factures et bons de commande non soldés, et des charges récurrentes actives (voir l'onglet « Charges récurrentes »).
        </p>
      </section>
    </div>
  );
}

function ChargesRecurrentes() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CHARGE);

  const canCreate = can('finance', 'create');
  const canUpdate = can('finance', 'update');
  const canDelete = can('finance', 'delete');

  const load = () => get('/finance/charges-recurrentes').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await post('/finance/charges-recurrentes', { ...form, montant: Number(form.montant) });
      setForm(EMPTY_CHARGE);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleActif = async (row) => {
    try {
      await patch(`/finance/charges-recurrentes/${row.id}`, { actif: !row.actif });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const supprimer = async (row) => {
    if (!window.confirm(`Supprimer « ${row.libelle} » ?`)) return;
    try {
      await del(`/finance/charges-recurrentes/${row.id}`);
      toast.success('Supprimé');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'libelle', label: 'Libellé' },
    { key: 'periodicite', label: 'Périodicité', render: (c) => PERIODICITE_LABEL[c.periodicite] || c.periodicite },
    { key: 'prochaine_echeance', label: 'Prochaine échéance', render: (c) => new Date(c.prochaine_echeance).toLocaleDateString('fr-FR') },
    { key: 'montant', label: 'Montant', render: (c) => fmt(c.montant) },
    {
      key: 'actif',
      label: 'Statut',
      render: (c) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {c.actif ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (c) => (
        <div className="flex items-center justify-end gap-3">
          {canUpdate && (
            <button className="text-xs text-hq-blue hover:underline" onClick={() => toggleActif(c)}>
              {c.actif ? 'Désactiver' : 'Activer'}
            </button>
          )}
          {canDelete && (
            <button className="text-xs text-red-600 hover:underline" onClick={() => supprimer(c)}>Supprimer</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} charge(s) récurrente(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle charge récurrente
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucune charge récurrente enregistrée." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle charge récurrente">
        <div className="space-y-3">
          <div>
            <label className="label">Libellé</label>
            <input className="input" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} placeholder="Ex. Loyer bureau, Masse salariale…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Montant</label>
              <input className="input" type="number" min="0" step="0.01" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
            </div>
            <div>
              <label className="label">Périodicité</label>
              <select className="input" value={form.periodicite} onChange={(e) => setForm({ ...form, periodicite: e.target.value })}>
                {Object.entries(PERIODICITE_LABEL).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Prochaine échéance</label>
            <input className="input" type="date" value={form.prochaine_echeance} onChange={(e) => setForm({ ...form, prochaine_echeance: e.target.value })} />
          </div>
          <p className="text-xs text-slate-400">
            Les occurrences suivantes sont projetées automatiquement selon la périodicité — inutile de les ressaisir.
          </p>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.libelle.trim() || Number(form.montant) <= 0 || !form.prochaine_echeance}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

export default function Tresorerie() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'charges-recurrentes' ? 'charges-recurrentes' : 'tresorerie';

  return (
    <div>
      <div className="mb-4 flex gap-2 rounded-lg bg-slate-100 p-1 w-fit">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSearchParams(t.key === 'tresorerie' ? {} : { tab: t.key })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-hq-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'tresorerie' ? <TresorerieOverview /> : <ChargesRecurrentes />}
    </div>
  );
}

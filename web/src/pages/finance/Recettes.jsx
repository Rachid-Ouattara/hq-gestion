import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { ACTIVITE_LABEL } from './statusMaps.js';

const EMPTY_FORM = { compte_id: '', source: '', montant: '0', reference: '', activite: 'formation' };
const EMPTY_PREVISION = { exercice: String(new Date().getFullYear()), mois: String(new Date().getMonth() + 1), activite: 'formation', montant_prevu: '0' };
const MOIS_LABEL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

const SUB_TABS = [
  { key: 'recettes', label: 'Recettes' },
  { key: 'previsions', label: 'Prévisions' },
];

function fmt(n) {
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
}

function ListeRecettes() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comptes, setComptes] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('finance', 'create');

  const load = () => get('/finance/recettes').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => { get('/finance/comptes?is_active=true').then(setComptes).catch(() => {}); }, []);

  const submit = async () => {
    try {
      await post('/finance/recettes', { ...form, montant: Number(form.montant) });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'compte_libelle', label: 'Compte', render: (r) => `${r.compte_code} — ${r.compte_libelle}` },
    { key: 'activite', label: 'Activité', render: (r) => ACTIVITE_LABEL[r.activite] || r.activite },
    { key: 'source', label: 'Source' },
    { key: 'date_recette', label: 'Date', render: (r) => new Date(r.date_recette).toLocaleDateString('fr-FR') },
    { key: 'montant', label: 'Montant', render: (r) => fmt(r.montant) },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} recette(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle recette
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucune recette enregistrée." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle recette">
        <div className="space-y-3">
          <div>
            <label className="label">Compte</label>
            <select className="input" value={form.compte_id} onChange={(e) => setForm({ ...form, compte_id: e.target.value })}>
              <option value="">Sélectionner…</option>
              {comptes.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.libelle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Activité</label>
            <select className="input" value={form.activite} onChange={(e) => setForm({ ...form, activite: e.target.value })}>
              {Object.entries(ACTIVITE_LABEL).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Source</label>
            <input className="input" placeholder="Ex. Subvention, vente de matériel…" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </div>
          <div>
            <label className="label">Montant</label>
            <input className="input" type="number" min="0" step="0.01" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
          </div>
          <div>
            <label className="label">Référence</label>
            <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.compte_id || !form.source.trim() || Number(form.montant) <= 0}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

function Previsions() {
  const { can } = useAuth();
  const toast = useToast();
  const [exercice, setExercice] = useState(String(currentYear));
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PREVISION);

  const canCreate = can('finance', 'create');

  const load = () => get(`/finance/previsions?exercice=${exercice}`).then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, [exercice]);

  const submit = async () => {
    try {
      await post('/finance/previsions', { ...form, montant_prevu: Number(form.montant_prevu) });
      setForm({ ...EMPTY_PREVISION, exercice });
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select className="input max-w-[10rem]" value={exercice} onChange={(e) => setExercice(e.target.value)}>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {canCreate && (
          <button className="btn-primary" onClick={() => { setForm({ ...EMPTY_PREVISION, exercice }); setOpen(true); }}>
            <Plus size={18} /> Nouvelle prévision
          </button>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Mois</th>
              <th className="px-4 py-3">Activité</th>
              <th className="px-4 py-3 text-right">Prévu</th>
              <th className="px-4 py-3 text-right">Réalisé</th>
              <th className="px-4 py-3 text-right">Écart</th>
              <th className="px-4 py-3 text-right">Taux</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(rows || []).map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5">{MOIS_LABEL[r.mois - 1]}</td>
                <td className="px-4 py-2.5">{ACTIVITE_LABEL[r.activite] || r.activite}</td>
                <td className="px-4 py-2.5 text-right">{fmt(r.montant_prevu)}</td>
                <td className="px-4 py-2.5 text-right">{fmt(r.montant_realise)}</td>
                <td className={`px-4 py-2.5 text-right font-medium ${Number(r.ecart_fcfa) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {fmt(r.ecart_fcfa)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {r.taux_realisation != null ? `${Math.round(Number(r.taux_realisation) * 100)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows && rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">Aucune prévision pour cet exercice.</p>}
      </div>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Prévision de recettes">
        <div className="space-y-3">
          <div>
            <label className="label">Exercice</label>
            <input className="input" value={form.exercice} onChange={(e) => setForm({ ...form, exercice: e.target.value })} />
          </div>
          <div>
            <label className="label">Mois</label>
            <select className="input" value={form.mois} onChange={(e) => setForm({ ...form, mois: e.target.value })}>
              {MOIS_LABEL.map((label, i) => (
                <option key={label} value={i + 1}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Activité</label>
            <select className="input" value={form.activite} onChange={(e) => setForm({ ...form, activite: e.target.value })}>
              {Object.entries(ACTIVITE_LABEL).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Montant prévu</label>
            <input className="input" type="number" min="0" step="0.01" value={form.montant_prevu} onChange={(e) => setForm({ ...form, montant_prevu: e.target.value })} />
          </div>
          <p className="text-xs text-slate-400">Enregistrer une prévision déjà existante (même mois + activité) met à jour son montant.</p>
          <button className="btn-primary w-full" onClick={submit} disabled={Number(form.montant_prevu) < 0}>
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

export default function Recettes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'previsions' ? 'previsions' : 'recettes';

  return (
    <div>
      <div className="mb-4 flex gap-2 rounded-lg bg-slate-100 p-1 w-fit">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSearchParams(t.key === 'recettes' ? {} : { tab: t.key })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-hq-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'recettes' ? <ListeRecettes /> : <Previsions />}
    </div>
  );
}

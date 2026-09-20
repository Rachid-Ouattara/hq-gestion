import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { get } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';

const SUB_TABS = [
  { key: 'creances', label: 'Créances clients' },
  { key: 'dettes', label: 'Dettes fournisseurs' },
];

function fmt(n) {
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
}

function RetardBadge({ jours }) {
  if (!jours) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
      <AlertTriangle size={12} /> {jours} j de retard
    </span>
  );
}

function CreancesClients() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [retardOnly, setRetardOnly] = useState(false);

  useEffect(() => {
    get(`/finance/creances${retardOnly ? '?retard=true' : ''}`).then(setRows).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retardOnly]);

  const totalReste = (rows || []).reduce((sum, r) => sum + Number(r.reste_a_recouvrer), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={retardOnly} onChange={(e) => setRetardOnly(e.target.checked)} />
          En retard uniquement
        </label>
        <p className="text-sm font-semibold text-hq-blue">Reste à recouvrer : {fmt(totalReste)}</p>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Facture</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Échéance</th>
              <th className="px-4 py-3 text-right">Total facturé</th>
              <th className="px-4 py-3 text-right">Encaissé</th>
              <th className="px-4 py-3 text-right">Reste</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(rows || []).map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5">{r.numero}</td>
                <td className="px-4 py-2.5">{r.client_nom}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {r.echeance ? new Date(r.echeance).toLocaleDateString('fr-FR') : '—'}
                    <RetardBadge jours={r.jours_retard} />
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">{fmt(r.montant_total)}</td>
                <td className="px-4 py-2.5 text-right">{fmt(r.total_encaisse)}</td>
                <td className="px-4 py-2.5 text-right font-medium">{fmt(r.reste_a_recouvrer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows && rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">Aucune créance.</p>}
      </div>
    </div>
  );
}

function DettesFournisseurs() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [retardOnly, setRetardOnly] = useState(false);

  useEffect(() => {
    get(`/finance/dettes${retardOnly ? '?retard=true' : ''}`).then(setRows).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retardOnly]);

  const totalReste = (rows || []).reduce((sum, r) => sum + Number(r.reste_a_payer), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={retardOnly} onChange={(e) => setRetardOnly(e.target.checked)} />
          En retard uniquement
        </label>
        <p className="text-sm font-semibold text-hq-blue">Reste à payer : {fmt(totalReste)}</p>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Bon de commande</th>
              <th className="px-4 py-3">Fournisseur</th>
              <th className="px-4 py-3">Échéance</th>
              <th className="px-4 py-3 text-right">Total facturé</th>
              <th className="px-4 py-3 text-right">Payé</th>
              <th className="px-4 py-3 text-right">Reste</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(rows || []).map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5">{r.numero}</td>
                <td className="px-4 py-2.5">{r.fournisseur_nom}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {r.echeance ? new Date(r.echeance).toLocaleDateString('fr-FR') : '—'}
                    <RetardBadge jours={r.jours_retard} />
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">{fmt(r.montant_total)}</td>
                <td className="px-4 py-2.5 text-right">{fmt(r.total_paye)}</td>
                <td className="px-4 py-2.5 text-right font-medium">{fmt(r.reste_a_payer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows && rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">Aucune dette.</p>}
      </div>
    </div>
  );
}

export default function Tiers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'dettes' ? 'dettes' : 'creances';

  return (
    <div>
      <div className="mb-4 flex gap-2 rounded-lg bg-slate-100 p-1 w-fit">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSearchParams(t.key === 'creances' ? {} : { tab: t.key })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-hq-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'creances' ? <CreancesClients /> : <DettesFournisseurs />}
    </div>
  );
}

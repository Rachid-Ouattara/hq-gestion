import { useEffect, useState } from 'react';
import { get } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { ECOLE_CIBLE_STATUT } from './statusMaps.js';

const FUNNEL_ORDER = ['a_contacter', 'contacte', 'interesse', 'en_negociation', 'partenaire'];
const SORTIES = ['refuse', 'abandonne'];

export default function Funnel() {
  const toast = useToast();
  const [parStatut, setParStatut] = useState(null);

  useEffect(() => {
    get('/prospection/kpi').then((d) => setParStatut(d.par_statut)).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!parStatut) return null;

  const max = Math.max(1, ...FUNNEL_ORDER.map((code) => parStatut[code] || 0));

  return (
    <section className="card mt-6 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Entonnoir de conversion</h2>
      <div className="space-y-2">
        {FUNNEL_ORDER.map((code) => {
          const n = parStatut[code] || 0;
          const pct = Math.round((n / max) * 100);
          return (
            <div key={code} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm text-slate-600">{ECOLE_CIBLE_STATUT[code].label}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-hq-blue" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-sm font-semibold text-slate-700">{n}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-500">
        {SORTIES.map((code) => (
          <span key={code}>
            {ECOLE_CIBLE_STATUT[code].label} : <strong className="text-slate-700">{parStatut[code] || 0}</strong>
          </span>
        ))}
      </div>
    </section>
  );
}

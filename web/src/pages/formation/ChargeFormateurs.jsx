import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function dureeHeures(s) {
  return (toMinutes(s.heure_fin) - toMinutes(s.heure_debut)) / 60;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function computeCharge(rows, key) {
  const inMonth = rows.filter((s) => s.date_seance.slice(0, 7) === key);
  const byFormateur = new Map();
  for (const s of inMonth) {
    if (!byFormateur.has(s.formateur_id)) {
      byFormateur.set(s.formateur_id, {
        formateur_id: s.formateur_id,
        nom: s.formateur_nom,
        prenom: s.formateur_prenom,
        nbSeances: 0,
        heures: 0,
      });
    }
    const entry = byFormateur.get(s.formateur_id);
    entry.nbSeances += 1;
    entry.heures += dureeHeures(s);
  }
  return Array.from(byFormateur.values()).sort((a, b) => b.heures - a.heures);
}

export default function ChargeFormateurs({ rows }) {
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));

  const key = monthKey(monthStart);
  const monthLabel = monthStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const data = useMemo(() => computeCharge(rows, key), [rows, key]);
  const max = Math.max(1, ...data.map((d) => d.heures));

  const goPrevMonth = () => setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNextMonth = () => setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setMonthStart(startOfMonth(new Date()));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={goPrevMonth} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
          <ChevronLeft size={18} />
        </button>
        <p className="min-w-[10rem] text-sm font-medium capitalize text-slate-700">{monthLabel}</p>
        <button onClick={goNextMonth} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
          <ChevronRight size={18} />
        </button>
        <button onClick={goToday} className="btn-ghost !py-1.5 text-xs">Ce mois</button>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune séance sur cette période.</p>
      ) : (
        <div className="card space-y-3 p-5">
          {data.map((d) => {
            const pct = Math.round((d.heures / max) * 100);
            return (
              <div key={d.formateur_id} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-sm text-slate-600">{d.nom} {d.prenom}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-hq-blue" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-32 shrink-0 text-right text-xs text-slate-500">
                  {d.nbSeances} séance{d.nbSeances > 1 ? 's' : ''} · {d.heures.toFixed(1)} h
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

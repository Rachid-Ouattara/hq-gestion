import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge.jsx';
import { DOMAINE_LABEL, SEANCE_STATUT } from './statusMaps.js';

const JOUR_LABEL = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date) {
  return date.toLocaleDateString('sv-SE'); // format YYYY-MM-DD sans décalage fuseau
}

function overlaps(a, b) {
  return a.heure_debut < b.heure_fin && a.heure_fin > b.heure_debut;
}

function findConflictIds(daySeances) {
  const conflictIds = new Set();
  const byFormateur = new Map();
  for (const s of daySeances) {
    if (!byFormateur.has(s.formateur_id)) byFormateur.set(s.formateur_id, []);
    byFormateur.get(s.formateur_id).push(s);
  }
  for (const list of byFormateur.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (overlaps(list[i], list[j])) {
          conflictIds.add(list[i].id);
          conflictIds.add(list[j].id);
        }
      }
    }
  }
  return conflictIds;
}

export default function SeancesCalendar({ rows, isStaff }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const todayISO = toISODate(new Date());

  const rangeLabel = `${weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const goPrevWeek = () => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const goNextWeek = () => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={goPrevWeek} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
          <ChevronLeft size={18} />
        </button>
        <p className="min-w-[10rem] text-sm font-medium text-slate-700">{rangeLabel}</p>
        <button onClick={goNextWeek} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
          <ChevronRight size={18} />
        </button>
        <button onClick={goToday} className="btn-ghost !py-1.5 text-xs">Aujourd'hui</button>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-2" style={{ minWidth: '980px' }}>
          {weekDays.map((day) => {
            const iso = toISODate(day);
            const daySeances = rows
              .filter((s) => s.date_seance.slice(0, 10) === iso)
              .sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));
            const conflictIds = findConflictIds(daySeances);
            const isToday = iso === todayISO;

            return (
              <div
                key={iso}
                className={`min-w-[140px] rounded-lg border p-2 ${isToday ? 'border-hq-orange' : 'border-slate-200'}`}
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {JOUR_LABEL[(day.getDay() + 6) % 7]} {day.getDate()}
                </p>
                <div className="space-y-1.5">
                  {daySeances.map((s) => {
                    const inConflict = conflictIds.has(s.id);
                    return (
                      <div
                        key={s.id}
                        className={`rounded-md border p-2 text-xs ${
                          inConflict || s.formateur_en_conge ? 'border-red-200 bg-red-50' : 'border-transparent bg-hq-blue-light'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-medium text-slate-700">
                            {s.heure_debut.slice(0, 5)}–{s.heure_fin.slice(0, 5)}
                          </p>
                          {(inConflict || s.formateur_en_conge) && <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-500" />}
                        </div>
                        <p className="text-slate-600">{s.ecole_nom ? `${s.ecole_nom} · ${s.salle_nom}` : s.camp_nom}</p>
                        <p className="text-slate-400">{DOMAINE_LABEL[s.domaine] || s.domaine}</p>
                        {isStaff && <p className="text-slate-500">{s.formateur_nom} {s.formateur_prenom}</p>}
                        {isStaff && s.formateur_en_conge && <p className="font-medium text-red-600">Formateur en congé</p>}
                        <div className="mt-1">
                          <StatusBadge status={s.statut} map={SEANCE_STATUT} />
                        </div>
                      </div>
                    );
                  })}
                  {daySeances.length === 0 && <p className="py-2 text-center text-xs text-slate-300">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

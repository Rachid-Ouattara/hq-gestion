import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { AGENDA_STATUT } from './statusMaps.js';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_LABEL = (d) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function getMonthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // lundi = 0
  const gridStart = new Date(year, month, 1 - startWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

const EMPTY_FORM = { titre: '', description: '', date_debut: '', date_fin: '', lieu: '', participants: '', participant_ids: [], generer_meet: false };

export default function Agenda() {
  const { can } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [events, setEvents] = useState([]);
  const [participantsDisponibles, setParticipantsDisponibles] = useState([]);
  const [googleStatus, setGoogleStatus] = useState({ connected: false });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detail, setDetail] = useState(null);

  const canCreate = can('administrative', 'create');
  const canUpdate = can('administrative', 'update');

  const grid = useMemo(() => getMonthGrid(month), [month]);

  const load = () => {
    const from = dayKey(grid[0]);
    const to = `${dayKey(grid[grid.length - 1])}T23:59:59`;
    get(`/administrative/agenda?from=${from}&to=${to}`).then(setEvents).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, [month]);
  useEffect(() => { get('/administrative/agenda/participants-disponibles').then(setParticipantsDisponibles).catch(() => {}); }, []);
  useEffect(() => { get('/rh/google/status').then(setGoogleStatus).catch(() => {}); }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const key = dayKey(new Date(ev.date_debut));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return map;
  }, [events]);

  const openCreateFor = (day) => {
    const start = new Date(day); start.setHours(9, 0, 0, 0);
    const end = new Date(day); end.setHours(10, 0, 0, 0);
    setForm({ ...EMPTY_FORM, date_debut: toLocalInput(start), date_fin: toLocalInput(end) });
    setOpen(true);
  };

  const toggleParticipant = (userId) => {
    setForm((f) => ({
      ...f,
      participant_ids: f.participant_ids.includes(userId)
        ? f.participant_ids.filter((id) => id !== userId)
        : [...f.participant_ids, userId],
    }));
  };

  const submit = async () => {
    try {
      await post('/administrative/agenda', form);
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Événement créé');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const terminer = async () => {
    try {
      await post(`/administrative/agenda/${detail.id}/terminer`, {});
      toast.success('Marqué terminé');
      setDetail(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const annuler = async () => {
    if (!window.confirm(`Annuler « ${detail.titre} » ?`)) return;
    try {
      await post(`/administrative/agenda/${detail.id}/annuler`, {});
      toast.success('Annulé');
      setDetail(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const today = dayKey(new Date());

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-ghost !p-2" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
          <p className="w-40 text-center text-sm font-medium capitalize text-slate-700">{MONTH_LABEL(month)}</p>
          <button className="btn-ghost !p-2" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => openCreateFor(new Date())}>Nouveau rendez-vous</button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
          {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((day) => {
            const key = dayKey(day);
            const dayEvents = eventsByDay.get(key) || [];
            const inMonth = day.getMonth() === month.getMonth();
            return (
              <div
                key={key}
                className={`min-h-[6.5rem] cursor-pointer border-b border-r border-slate-100 p-1.5 last:border-r-0 hover:bg-hq-blue-light/20 ${!inMonth ? 'bg-slate-50/50' : ''}`}
                onClick={() => canCreate && openCreateFor(day)}
              >
                <p className={`mb-1 text-xs ${key === today ? 'grid h-5 w-5 place-items-center rounded-full bg-hq-orange font-semibold text-white' : inMonth ? 'text-slate-500' : 'text-slate-300'}`}>
                  {day.getDate()}
                </p>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); setDetail(ev); }}
                      className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] ${
                        ev.statut === 'annule' ? 'bg-slate-100 text-slate-400 line-through' : 'bg-hq-blue-light text-hq-blue'
                      }`}
                    >
                      {ev.titre}
                    </button>
                  ))}
                  {dayEvents.length > 3 && <p className="px-1 text-[10px] text-slate-400">+{dayEvents.length - 3} autre(s)</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau rendez-vous">
        <div className="space-y-3">
          <div>
            <label className="label">Titre</label>
            <input className="input" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Début</label>
              <input className="input" type="datetime-local" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
            </div>
            <div>
              <label className="label">Fin</label>
              <input className="input" type="datetime-local" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Lieu</label>
            <input className="input" value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} />
          </div>
          <div>
            <label className="label">Participants (comptes HQ Gestion)</label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {participantsDisponibles.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.participant_ids.includes(u.id)} onChange={() => toggleParticipant(u.id)} />
                  {u.full_name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Invités externes (texte libre)</label>
            <input className="input" placeholder="Ex. Représentant école X" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {googleStatus.connected && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.generer_meet} onChange={(e) => setForm({ ...form, generer_meet: e.target.checked })} />
              Générer un lien Google Meet
            </label>
          )}
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.titre.trim() || !form.date_debut || !form.date_fin}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>

      <SlideOver open={!!detail} onClose={() => setDetail(null)} title={detail?.titre || ''}>
        {detail && (
          <div className="space-y-3 text-sm">
            <StatusBadge status={detail.statut} map={AGENDA_STATUT} />
            <p className="text-slate-700">
              {new Date(detail.date_debut).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
              {' → '}
              {new Date(detail.date_fin).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}
            </p>
            {detail.lieu && <p className="text-slate-500">Lieu : {detail.lieu}</p>}
            {detail.description && <p className="text-slate-600">{detail.description}</p>}
            {detail.meet_link && (
              <a href={detail.meet_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-hq-cyan hover:text-hq-cyan-dark">
                <Video size={14} /> Rejoindre sur Google Meet
              </a>
            )}
            {detail.participants_internes?.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Participants</p>
                <ul className="space-y-0.5 text-slate-700">
                  {detail.participants_internes.map((p) => <li key={p.id}>{p.full_name}</li>)}
                </ul>
              </div>
            )}
            {detail.participants && <p className="text-slate-500">Invités externes : {detail.participants}</p>}
            {detail.statut === 'planifie' && canUpdate && (
              <div className="flex gap-2 pt-2">
                <button className="btn-ghost !py-1.5 text-xs" onClick={terminer}>Marquer terminé</button>
                <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50" onClick={annuler}>Annuler</button>
              </div>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  );
}

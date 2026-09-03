import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ClipboardCheck, FileClock, Clock } from 'lucide-react';
import { get } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';

function Section({ icon: Icon, title, rows, empty, renderRow, onRowClick }) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
        <Icon size={15} /> {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">Rien à signaler.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id || `${r.employe_id}-${r.type}`}>
              <button
                className="flex w-full items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-hq-blue-light/40"
                onClick={() => onRowClick(r)}
              >
                {renderRow(r)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ATraiter() {
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    get('/rh/kpi/a-traiter').then(setData).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return null;

  const overdue = (date) => new Date(date) <= new Date(new Date().toDateString());

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">À traiter</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          icon={FileClock}
          title="Contrats à échéance"
          rows={data.contrats}
          onRowClick={(r) => navigate(`/modules/rh/employes/${r.employe_id}`)}
          renderRow={(c) => (
            <>
              <span className="text-slate-700">{c.employe_nom} {c.employe_prenom} <span className="text-slate-400">· {c.numero}</span></span>
              <span className={`flex items-center gap-1 whitespace-nowrap ${overdue(c.date_fin) ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                {overdue(c.date_fin) && <AlertTriangle size={13} />}
                {new Date(c.date_fin).toLocaleDateString('fr-FR')}
              </span>
            </>
          )}
        />

        <Section
          icon={CalendarClock}
          title="Entretiens à venir"
          rows={data.entretiens}
          onRowClick={(r) => navigate(`/modules/rh/candidats/${r.candidat_id}`)}
          renderRow={(en) => (
            <>
              <span className="text-slate-700">{en.nom} {en.prenom} <span className="text-slate-400">· {en.poste_titre}</span></span>
              <span className="whitespace-nowrap text-slate-500">
                {new Date(en.date_entretien).toLocaleDateString('fr-FR')}{en.heure_debut ? ` · ${en.heure_debut.slice(0, 5)}` : ''}
              </span>
            </>
          )}
        />

        <Section
          icon={ClipboardCheck}
          title="Intégrations & départs en cours"
          rows={data.checklists}
          onRowClick={(r) => navigate(`/modules/rh/employes/${r.employe_id}`)}
          renderRow={(c) => (
            <>
              <span className="text-slate-700">{c.nom} {c.prenom} <span className="text-slate-400">· {c.type === 'arrivee' ? 'Intégration' : 'Départ'}</span></span>
              <span className="whitespace-nowrap text-slate-500">{c.restantes} étape(s) restante(s)</span>
            </>
          )}
        />

        <Section
          icon={Clock}
          title="Congés en attente"
          rows={data.conges}
          onRowClick={(r) => navigate(`/modules/rh/conges/${r.id}`)}
          renderRow={(c) => (
            <>
              <span className="text-slate-700">{c.nom} {c.prenom} <span className="text-slate-400">· {c.numero}</span></span>
              <span className="whitespace-nowrap text-slate-500">{new Date(c.date_debut).toLocaleDateString('fr-FR')}</span>
            </>
          )}
        />
      </div>
    </div>
  );
}

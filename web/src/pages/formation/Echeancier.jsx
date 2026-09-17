import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Wrench } from 'lucide-react';
import { get } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';

export default function Echeancier() {
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    get('/formation/maintenance/echeancier').then(setRows).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rows) return null;

  return (
    <section className="card mt-6 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Échéancier de maintenance</h2>
      {rows.length === 0 && (
        <p className="text-sm text-slate-400">Aucune salle n'a de fréquence de maintenance programmée.</p>
      )}
      <div className="space-y-2">
        {rows.map((r) => {
          const overdue = new Date(r.prochaine_echeance) <= new Date(new Date().toDateString());
          return (
            <div
              key={r.salle_id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
                overdue ? 'border-red-200 bg-red-50' : 'border-slate-100'
              }`}
            >
              <div>
                <p className="font-medium text-slate-700">{r.ecole_nom} · {r.salle_nom}</p>
                <p className="text-xs text-slate-400">
                  Tous les {r.frequence_maintenance_mois} mois — dernière visite :{' '}
                  {r.derniere_visite ? new Date(r.derniere_visite).toLocaleDateString('fr-FR') : 'jamais visitée'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`flex items-center gap-1 ${overdue ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                  {overdue && <AlertTriangle size={14} />}
                  Échéance : {new Date(r.prochaine_echeance).toLocaleDateString('fr-FR')}
                </span>
                <button
                  className="btn-ghost !py-1.5 text-xs"
                  onClick={() => navigate(`/modules/formation/ecoles?tab=maintenance&ecole_id=${r.ecole_id}&salle_id=${r.salle_id}`)}
                >
                  <Wrench size={14} /> Planifier une visite
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

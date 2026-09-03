import { useEffect, useState } from 'react';
import { LogIn, LogOut, MapPinOff, Clock3 } from 'lucide-react';
import { get, post } from '../lib/api.js';

const fmtTime = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export default function PointageWidget() {
  const [pointage, setPointage] = useState(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    get('/rh/pointage/mon-jour')
      .then((p) => {
        setPointage(p);
        setVisible(true);
      })
      .catch(() => setVisible(false));

  useEffect(() => {
    load();
  }, []);

  const pointer = async (type) => {
    setBusy(true);
    setError('');
    try {
      const p = await post(`/rh/pointage/pointer/${type}`, {});
      setPointage(p);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  const arrived = Boolean(pointage?.heure_arrivee);
  const departed = Boolean(pointage?.heure_depart);

  return (
    <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-hq-blue-light">
          <Clock3 size={20} className="text-hq-blue" />
        </span>
        <div>
          <p className="text-sm font-medium text-slate-800">Présence du jour</p>
          {!arrived && <p className="text-xs text-slate-500">Vous n'avez pas encore pointé votre arrivée.</p>}
          {arrived && !departed && (
            <p className="text-xs text-slate-500">
              Arrivée à <span className="font-medium text-slate-700">{fmtTime(pointage.heure_arrivee)}</span>
              {pointage.statut === 'retard' && <span className="ml-1 text-hq-orange-dark">(retard)</span>}
            </p>
          )}
          {arrived && departed && (
            <p className="text-xs text-slate-500">
              Arrivée <span className="font-medium text-slate-700">{fmtTime(pointage.heure_arrivee)}</span> · Départ{' '}
              <span className="font-medium text-slate-700">{fmtTime(pointage.heure_depart)}</span>
            </p>
          )}
          {error && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
              <MapPinOff size={12} /> {error}
            </p>
          )}
        </div>
      </div>

      {!departed && (
        <button
          className="btn-primary"
          disabled={busy}
          onClick={() => pointer(arrived ? 'depart' : 'arrivee')}
        >
          {arrived ? <LogOut size={18} /> : <LogIn size={18} />}
          {arrived ? 'Pointer mon départ' : 'Pointer mon arrivée'}
        </button>
      )}
    </div>
  );
}

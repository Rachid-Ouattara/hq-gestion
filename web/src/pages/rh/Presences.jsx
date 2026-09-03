import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { get, post, patch, del } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { POINTAGE_STATUT, POINTAGE_SOURCE_LABEL } from './statusMaps.js';

const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—');

/** Combine une date (AAAA-MM-JJ) et une heure (HH:MM) locales en ISO UTC explicite,
 * pour éviter que le fuseau de session Postgres ne réinterprète une chaîne naïve. */
const localToIso = (dateStr, timeStr) => {
  if (!timeStr) return '';
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);
  return new Date(y, mo - 1, d, h, m).toISOString();
};

const EMPTY_IP = { label: '', ip_ou_cidr: '' };
const EMPTY_MANUEL = { employe_id: '', date_jour: todayIso(), heure_arrivee: '', heure_depart: '', notes: '' };

export default function Presences() {
  const { can } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showParams, setShowParams] = useState(false);
  const [parametres, setParametres] = useState(null);
  const [ips, setIps] = useState([]);
  const [ipForm, setIpForm] = useState(EMPTY_IP);
  const [manuelOpen, setManuelOpen] = useState(false);
  const [manuelForm, setManuelForm] = useState(EMPTY_MANUEL);
  const [employes, setEmployes] = useState([]);

  const canWrite = can('rh', 'update');

  const load = () =>
    get(`/rh/pointage?date=${date}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));

  useEffect(() => { setLoading(true); load(); }, [date]);
  useEffect(() => {
    get('/rh/pointage/parametres').then(setParametres).catch(() => {});
    get('/rh/pointage/ip-autorisees').then(setIps).catch(() => {});
    get('/rh/employes').then(setEmployes).catch(() => {});
  }, []);

  const saveParametres = async () => {
    try {
      await patch('/rh/pointage/parametres', {
        heure_arrivee_attendue: parametres.heure_arrivee_attendue,
        tolerance_minutes: Number(parametres.tolerance_minutes),
      });
      toast.success('Paramètres enregistrés');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const addIp = async () => {
    try {
      const created = await post('/rh/pointage/ip-autorisees', ipForm);
      setIps([created, ...ips]);
      setIpForm(EMPTY_IP);
      toast.success('IP autorisée ajoutée');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const removeIp = async (id) => {
    try {
      await del(`/rh/pointage/ip-autorisees/${id}`);
      setIps(ips.filter((i) => i.id !== id));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const submitManuel = async () => {
    try {
      await post('/rh/pointage/manuel', {
        ...manuelForm,
        heure_arrivee: localToIso(manuelForm.date_jour, manuelForm.heure_arrivee),
        heure_depart: localToIso(manuelForm.date_jour, manuelForm.heure_depart),
      });
      setManuelOpen(false);
      setManuelForm(EMPTY_MANUEL);
      toast.success('Pointage enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'employe', label: 'Employé', render: (p) => `${p.prenom} ${p.nom}` },
    { key: 'heure_arrivee', label: 'Arrivée', render: (p) => fmtTime(p.heure_arrivee) },
    { key: 'heure_depart', label: 'Départ', render: (p) => fmtTime(p.heure_depart) },
    { key: 'statut', label: 'Statut', render: (p) => <StatusBadge status={p.statut} map={POINTAGE_STATUT} /> },
    { key: 'source', label: 'Source', render: (p) => POINTAGE_SOURCE_LABEL[p.source] || p.source },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="label mb-0">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {canWrite && (
          <button className="btn-primary" onClick={() => setManuelOpen(true)}>
            <Plus size={18} /> Pointage manuel
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucun pointage pour cette date." />

      <div className="card mt-6 p-4">
        <button
          className="flex w-full items-center justify-between text-left"
          onClick={() => setShowParams(!showParams)}
        >
          <span className="text-sm font-semibold text-hq-blue">Paramètres du pointage</span>
          {showParams ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showParams && (
          <div className="mt-4 space-y-6">
            {parametres && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                <div>
                  <label className="label">Heure d'arrivée attendue</label>
                  <input
                    type="time"
                    className="input"
                    value={parametres.heure_arrivee_attendue?.slice(0, 5) || ''}
                    onChange={(e) => setParametres({ ...parametres, heure_arrivee_attendue: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Tolérance (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={parametres.tolerance_minutes}
                    onChange={(e) => setParametres({ ...parametres, tolerance_minutes: e.target.value })}
                  />
                </div>
                <button className="btn-ghost" onClick={saveParametres}>Enregistrer</button>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Réseau autorisé (adresses IP du bureau)</p>
              <ul className="mb-3 divide-y divide-slate-100">
                {ips.map((ip) => (
                  <li key={ip.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="font-medium text-slate-700">{ip.label}</span>{' '}
                      <span className="text-slate-400">— {ip.ip_ou_cidr}</span>
                    </span>
                    <button onClick={() => removeIp(ip.id)} className="text-slate-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
                {ips.length === 0 && <li className="py-2 text-sm text-slate-400">Aucune IP autorisée — le pointage est bloqué pour tous.</li>}
              </ul>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="label">Libellé</label>
                  <input className="input" placeholder="Ex. Réseau bureau" value={ipForm.label} onChange={(e) => setIpForm({ ...ipForm, label: e.target.value })} />
                </div>
                <div>
                  <label className="label">IP ou CIDR</label>
                  <input className="input" placeholder="Ex. 41.202.x.x/32" value={ipForm.ip_ou_cidr} onChange={(e) => setIpForm({ ...ipForm, ip_ou_cidr: e.target.value })} />
                </div>
                <button className="btn-ghost" onClick={addIp} disabled={!ipForm.label.trim() || !ipForm.ip_ou_cidr.trim()}>
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <SlideOver open={manuelOpen} onClose={() => setManuelOpen(false)} title="Pointage manuel">
        <div className="space-y-3">
          <div>
            <label className="label">Employé</label>
            <select className="input" value={manuelForm.employe_id} onChange={(e) => setManuelForm({ ...manuelForm, employe_id: e.target.value })}>
              <option value="">Sélectionner…</option>
              {employes.map((e) => (
                <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.matricule})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={manuelForm.date_jour} onChange={(e) => setManuelForm({ ...manuelForm, date_jour: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Heure d'arrivée</label>
              <input type="time" className="input" value={manuelForm.heure_arrivee} onChange={(e) => setManuelForm({ ...manuelForm, heure_arrivee: e.target.value })} />
            </div>
            <div>
              <label className="label">Heure de départ</label>
              <input type="time" className="input" value={manuelForm.heure_depart} onChange={(e) => setManuelForm({ ...manuelForm, heure_depart: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} placeholder="Ex. Oubli de badgeage" value={manuelForm.notes} onChange={(e) => setManuelForm({ ...manuelForm, notes: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submitManuel} disabled={!manuelForm.employe_id || !manuelForm.date_jour}>
            Enregistrer
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

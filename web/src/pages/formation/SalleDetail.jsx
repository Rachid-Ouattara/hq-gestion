import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Plus } from 'lucide-react';
import { get, patch, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { EQUIPEMENT_ETAT, EQUIPEMENT_TYPE_LABEL } from './statusMaps.js';

const EMPTY_FORM = { type_equipement: 'pc', designation: '', numero_serie: '', date_installation: '' };

const FREQUENCE_OPTIONS = [
  { value: '', label: 'Aucune' },
  { value: '1', label: 'Tous les mois' },
  { value: '3', label: 'Tous les 3 mois' },
  { value: '6', label: 'Tous les 6 mois' },
  { value: '12', label: 'Tous les 12 mois' },
];

export default function SalleDetail() {
  const { ecoleId, salleId } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [salle, setSalle] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const canCreate = can('formation', 'create');

  const load = useCallback(() => {
    get(`/formation/ecoles/${ecoleId}/salles/${salleId}`).then(setSalle).catch((e) => setError(e.message));
  }, [ecoleId, salleId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    try {
      await post('/formation/equipements', { ...form, salle_id: salleId });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const changerFrequence = async (value) => {
    try {
      await patch(`/formation/ecoles/${ecoleId}/salles/${salleId}`, {
        frequence_maintenance_mois: value === '' ? null : Number(value),
      });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!salle) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate(`/modules/formation/ecoles/${ecoleId}`)} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour à {salle.ecole_nom}
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-hq-blue">{salle.nom}</h1>
          <p className="text-sm text-slate-500">{salle.ecole_nom}{salle.capacite ? ` · capacité ${salle.capacite}` : ''}</p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvel équipement
          </button>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Maintenance préventive</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="label">Fréquence</label>
            <select
              className="input max-w-xs"
              value={salle.frequence_maintenance_mois || ''}
              onChange={(e) => changerFrequence(e.target.value)}
            >
              {FREQUENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {salle.prochaine_echeance && (() => {
            const overdue = new Date(salle.prochaine_echeance) <= new Date(new Date().toDateString());
            const label = new Date(salle.prochaine_echeance).toLocaleDateString('fr-FR');
            return (
              <p className={`flex items-center gap-1 text-sm ${overdue ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                {overdue && <AlertTriangle size={14} />} Prochaine échéance : {label}
              </p>
            );
          })()}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Équipements</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-2">Type</th>
              <th className="py-2">Désignation</th>
              <th className="py-2">N° série</th>
              <th className="py-2">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {salle.equipements.map((e) => (
              <tr key={e.id}>
                <td className="py-2">{EQUIPEMENT_TYPE_LABEL[e.type_equipement] || e.type_equipement}</td>
                <td className="py-2">{e.designation}</td>
                <td className="py-2 text-slate-500">{e.numero_serie || '—'}</td>
                <td className="py-2"><StatusBadge status={e.etat} map={EQUIPEMENT_ETAT} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {salle.equipements.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Aucun équipement enregistré.</p>}
      </section>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvel équipement">
        <div className="space-y-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type_equipement} onChange={(e) => setForm({ ...form, type_equipement: e.target.value })}>
              {Object.entries(EQUIPEMENT_TYPE_LABEL).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Désignation</label>
            <input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Ex. PC HQ #1" />
          </div>
          <div>
            <label className="label">Numéro de série</label>
            <input className="input" value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} />
          </div>
          <div>
            <label className="label">Date d'installation</label>
            <input className="input" type="date" value={form.date_installation} onChange={(e) => setForm({ ...form, date_installation: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.designation.trim()}>Enregistrer</button>
        </div>
      </SlideOver>
    </div>
  );
}

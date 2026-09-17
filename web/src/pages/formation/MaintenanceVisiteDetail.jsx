import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Plus } from 'lucide-react';
import { get, patch, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { CONSTAT_STATUT, EQUIPEMENT_TYPE_LABEL, VISITE_STATUT } from './statusMaps.js';

const EMPTY_FORM = { equipement_id: '', panne_constatee: '', solution: '' };

export default function MaintenanceVisiteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [visite, setVisite] = useState(null);
  const [equipements, setEquipements] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const canCreate = can('formation', 'create');
  const canUpdate = can('formation', 'update');

  const load = useCallback(() => {
    get(`/formation/maintenance/visites/${id}`).then(setVisite).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!visite) return;
    get(`/formation/equipements?salle_id=${visite.salle_id || ''}&ecole_id=${visite.ecole_id}`).then(setEquipements).catch(() => {});
  }, [visite]);

  const submit = async () => {
    try {
      await post(`/formation/maintenance/visites/${id}/constats`, form);
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const changerStatutConstat = async (constatId, statut) => {
    try {
      await patch(`/formation/maintenance/constats/${constatId}/statut`, { statut });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const marquerRealisee = async () => {
    try {
      await patch(`/formation/maintenance/visites/${id}/statut`, { statut: 'realisee' });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!visite) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/formation/ecoles?tab=maintenance')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux visites
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{visite.numero}</h1>
            <StatusBadge status={visite.statut} map={VISITE_STATUT} />
          </div>
          <p className="text-sm text-slate-500">
            {visite.ecole_nom}{visite.salle_nom ? ` · ${visite.salle_nom}` : ''} · {new Date(visite.date_visite).toLocaleDateString('fr-FR')}
            {visite.technicien_nom ? ` · ${visite.technicien_nom} ${visite.technicien_prenom}` : ''}
          </p>
        </div>
        {visite.statut === 'planifiee' && canUpdate && (
          <button className="btn-primary" onClick={marquerRealisee}>
            <CheckCircle2 size={16} /> Marquer réalisée
          </button>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Constats</h2>
          {canCreate && (
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setOpen(true)}>
              <Plus size={14} /> Ajouter un constat
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-2">Équipement</th>
              <th className="py-2">Panne constatée</th>
              <th className="py-2">Solution</th>
              <th className="py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visite.constats.map((c) => (
              <tr key={c.id}>
                <td className="py-2">{c.equipement_designation} <span className="text-slate-400">({EQUIPEMENT_TYPE_LABEL[c.type_equipement]})</span></td>
                <td className="py-2">{c.panne_constatee}</td>
                <td className="py-2 text-slate-500">{c.solution || '—'}</td>
                <td className="py-2">
                  {canUpdate ? (
                    <select className="input !py-1" value={c.statut} onChange={(e) => changerStatutConstat(c.id, e.target.value)}>
                      {Object.entries(CONSTAT_STATUT).map(([code, s]) => (
                        <option key={code} value={code}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge status={c.statut} map={CONSTAT_STATUT} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visite.constats.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Aucun constat enregistré.</p>}
      </section>

      <div className="mt-6">
        <AttachmentsPanel moduleCode="formation" entityType="maintenance_visite" entityId={id} />
      </div>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau constat">
        <div className="space-y-3">
          <div>
            <label className="label">Équipement</label>
            <select className="input" value={form.equipement_id} onChange={(e) => setForm({ ...form, equipement_id: e.target.value })}>
              <option value="">Sélectionner…</option>
              {equipements.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.designation} ({EQUIPEMENT_TYPE_LABEL[eq.type_equipement]}) — {eq.salle_nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Panne constatée</label>
            <textarea className="input" rows={2} value={form.panne_constatee} onChange={(e) => setForm({ ...form, panne_constatee: e.target.value })} />
          </div>
          <div>
            <label className="label">Solution proposée / appliquée</label>
            <textarea className="input" rows={2} value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.equipement_id || !form.panne_constatee.trim()}>
            Enregistrer le constat
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

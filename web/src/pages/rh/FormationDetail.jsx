import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, UserPlus } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { FORMATION_STATUT, PARTICIPATION_STATUT } from './statusMaps.js';

export default function FormationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [formation, setFormation] = useState(null);
  const [employes, setEmployes] = useState([]);
  const [selectedEmploye, setSelectedEmploye] = useState('');
  const [error, setError] = useState('');

  const canUpdate = can('rh', 'update');

  const load = useCallback(() => {
    get(`/rh/formations/${id}`).then(setFormation).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { get('/rh/employes?statut=actif').then(setEmployes).catch(() => {}); }, []);

  const ajouterParticipant = async () => {
    if (!selectedEmploye) return;
    try {
      await post(`/rh/formations/${id}/participants`, { employe_id: selectedEmploye });
      setSelectedEmploye('');
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const changerStatut = async (participantId, statut_participation) => {
    try {
      await patch(`/rh/formations/${id}/participants/${participantId}`, { statut_participation });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const retirer = async (participantId) => {
    if (!window.confirm('Retirer ce participant ?')) return;
    try {
      await del(`/rh/formations/${id}/participants/${participantId}`);
      toast.success('Supprimé');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const changerStatutFormation = async (statut) => {
    try {
      await patch(`/rh/formations/${id}/statut`, { statut });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!formation) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  const inscritIds = new Set(formation.participants.map((p) => p.employe_id));
  const employesDisponibles = employes.filter((e) => !inscritIds.has(e.id));

  return (
    <div>
      <button onClick={() => navigate('/modules/rh/formations')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux formations
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{formation.numero} — {formation.titre}</h1>
            <StatusBadge status={formation.statut} map={FORMATION_STATUT} />
          </div>
          <p className="text-sm text-slate-500">
            {formation.organisme ? `${formation.organisme} · ` : ''}
            {new Date(formation.date_debut).toLocaleDateString('fr-FR')} → {new Date(formation.date_fin).toLocaleDateString('fr-FR')}
            {formation.lieu ? ` · ${formation.lieu}` : ''}
          </p>
        </div>
        {canUpdate && (
          <select
            className="input max-w-[10rem]"
            value={formation.statut}
            onChange={(e) => changerStatutFormation(e.target.value)}
          >
            {Object.entries(FORMATION_STATUT).map(([code, s]) => (
              <option key={code} value={code}>{s.label}</option>
            ))}
          </select>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Participants ({formation.participants.length})
        </h2>

        {canUpdate && (
          <div className="mb-4 flex gap-2">
            <select className="input" value={selectedEmploye} onChange={(e) => setSelectedEmploye(e.target.value)}>
              <option value="">Sélectionner un employé…</option>
              {employesDisponibles.map((e) => (
                <option key={e.id} value={e.id}>{e.nom} {e.prenom} — {e.poste}</option>
              ))}
            </select>
            <button className="btn-primary shrink-0" onClick={ajouterParticipant} disabled={!selectedEmploye}>
              <UserPlus size={16} /> Inscrire
            </button>
          </div>
        )}

        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-2">Employé</th>
              <th className="py-2">Poste</th>
              <th className="py-2">Statut</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {formation.participants.map((p) => (
              <tr key={p.id}>
                <td className="py-2 text-slate-700">{p.employe_nom} {p.employe_prenom}</td>
                <td className="py-2 text-slate-500">{p.employe_poste}</td>
                <td className="py-2">
                  {canUpdate ? (
                    <select
                      className="input !py-1"
                      value={p.statut_participation}
                      onChange={(e) => changerStatut(p.id, e.target.value)}
                    >
                      {Object.entries(PARTICIPATION_STATUT).map(([code, s]) => (
                        <option key={code} value={code}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge status={p.statut_participation} map={PARTICIPATION_STATUT} />
                  )}
                </td>
                <td className="py-2 text-right">
                  {canUpdate && (
                    <button className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => retirer(p.id)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {formation.participants.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Aucun participant inscrit.</p>}
      </section>
    </div>
  );
}

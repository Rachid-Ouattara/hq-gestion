import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Plus } from 'lucide-react';
import { get, patch, post, put } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { CAMPAGNE_STATUT } from './statusMaps.js';

export default function CampagneDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [campagne, setCampagne] = useState(null);
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState('');

  const [membresOpen, setMembresOpen] = useState(false);
  const [groupeId, setGroupeId] = useState('');
  const [employesActifs, setEmployesActifs] = useState([]);
  const [selection, setSelection] = useState([]);

  const canCreate = can('prospection', 'create');
  const canUpdate = can('prospection', 'update');

  const load = useCallback(() => {
    get(`/prospection/campagnes/${id}`).then(setCampagne).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const creerGroupe = async () => {
    try {
      await post('/prospection/groupes', { campagne_id: id, nom });
      setNom('');
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const cloturer = async () => {
    if (!window.confirm('Clôturer cette campagne ?')) return;
    try {
      await patch(`/prospection/campagnes/${id}/statut`, { statut: 'cloturee' });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openMembres = async (groupe) => {
    setGroupeId(groupe.id);
    if (employesActifs.length === 0) {
      const all = await get('/rh/employes?statut=actif').catch(() => []);
      setEmployesActifs(all);
    }
    const detail = await get(`/prospection/groupes/${groupe.id}`).catch(() => null);
    setSelection((detail?.membres || []).map((m) => m.employe_id));
    setMembresOpen(true);
  };

  const toggleMembre = (employeId) => {
    setSelection((cur) => (cur.includes(employeId) ? cur.filter((id_) => id_ !== employeId) : [...cur, employeId]));
  };

  const saveMembres = async () => {
    try {
      await put(`/prospection/groupes/${groupeId}/membres`, { employe_ids: selection });
      setMembresOpen(false);
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!campagne) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/prospection/campagnes')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux campagnes
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{campagne.nom}</h1>
            <StatusBadge status={campagne.statut} map={CAMPAGNE_STATUT} />
          </div>
          <p className="text-sm text-slate-500">
            {campagne.annee} · {new Date(campagne.date_debut).toLocaleDateString('fr-FR')} → {new Date(campagne.date_fin).toLocaleDateString('fr-FR')}
          </p>
        </div>
        {campagne.statut === 'active' && canUpdate && (
          <button className="btn-ghost" onClick={cloturer}><Lock size={16} /> Clôturer</button>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Groupes de prospection</h2>
          {canCreate && (
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setOpen(true)}>
              <Plus size={14} /> Nouveau groupe
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-2">Groupe</th>
              <th className="py-2">Membres</th>
              <th className="py-2">Écoles assignées</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campagne.groupes.map((g) => (
              <tr key={g.id}>
                <td className="py-2 text-slate-700">{g.nom}</td>
                <td className="py-2">{g.nb_membres}</td>
                <td className="py-2">{g.nb_ecoles}</td>
                <td className="py-2 text-right">
                  {canUpdate && (
                    <button className="text-xs text-hq-blue hover:underline" onClick={() => openMembres(g)}>
                      Gérer les membres
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {campagne.groupes.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Aucun groupe créé.</p>}
      </section>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau groupe">
        <div className="space-y-3">
          <div>
            <label className="label">Nom du groupe</label>
            <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Groupe A" />
          </div>
          <button className="btn-primary w-full" onClick={creerGroupe} disabled={!nom.trim()}>Enregistrer</button>
        </div>
      </SlideOver>

      <SlideOver open={membresOpen} onClose={() => setMembresOpen(false)} title="Membres du groupe">
        <div className="space-y-2">
          {employesActifs.map((e) => (
            <label key={e.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={selection.includes(e.id)} onChange={() => toggleMembre(e.id)} />
              {e.nom} {e.prenom} — {e.poste}
            </label>
          ))}
          {employesActifs.length === 0 && <p className="text-sm text-slate-400">Aucun employé actif.</p>}
          <button className="btn-primary mt-2 w-full" onClick={saveMembres}>Enregistrer</button>
        </div>
      </SlideOver>
    </div>
  );
}

import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Globe, Plus, Share2, Users } from 'lucide-react';
import { get, patch, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { CANDIDAT_STATUT, POSTE_STATUT, TYPE_CONTRAT_LABEL } from './statusMaps.js';

const EMPTY_FORM = { nom: '', prenom: '', email: '', telephone: '', source: '' };
const EMPTY_GROUPE = { date_entretien: '', heure_debut: '', evaluateur_id: '', mode: 'presentiel', generer_meet: false };

export default function PosteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [poste, setPoste] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [employes, setEmployes] = useState([]);
  const [googleStatus, setGoogleStatus] = useState({ connected: false });
  const [selected, setSelected] = useState(() => new Set());
  const [groupeOpen, setGroupeOpen] = useState(false);
  const [groupeForm, setGroupeForm] = useState(EMPTY_GROUPE);

  const canCreate = can('rh', 'create');
  const canUpdate = can('rh', 'update');

  const load = useCallback(() => {
    get(`/rh/postes/${id}`).then(setPoste).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { get('/rh/employes?statut=actif').then(setEmployes).catch(() => {}); }, []);
  useEffect(() => { get('/rh/google/status').then(setGoogleStatus).catch(() => {}); }, []);

  const submit = async () => {
    try {
      await post('/rh/candidats', { ...form, poste_id: id });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const changerStatut = async (statut) => {
    try {
      await patch(`/rh/postes/${id}/statut`, { statut });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const togglePublier = async () => {
    try {
      await patch(`/rh/postes/${id}`, { avis_publie: !poste.avis_publie });
      toast.success(poste.avis_publie ? "Offre dépubliée" : 'Offre publiée');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const publicLink = `${window.location.origin}/postuler/${id}`;

  const copierLien = async () => {
    await navigator.clipboard.writeText(publicLink);
    toast.success('Lien copié');
  };

  const partagerFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicLink)}`, '_blank', 'noopener,noreferrer');
  };

  const toggleSelect = (candidatId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(candidatId)) next.delete(candidatId);
      else next.add(candidatId);
      return next;
    });
  };

  const submitGroupe = async () => {
    try {
      await post('/rh/candidats/entretiens/groupe', { ...groupeForm, candidat_ids: Array.from(selected) });
      setGroupeForm(EMPTY_GROUPE);
      setGroupeOpen(false);
      setSelected(new Set());
      toast.success('Entretien groupé planifié');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!poste) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/rh/recrutement')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux postes
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{poste.titre}</h1>
            <StatusBadge status={poste.statut} map={POSTE_STATUT} />
          </div>
          <p className="text-sm text-slate-500">
            {poste.numero} · {poste.departement || 'Département non renseigné'} · {TYPE_CONTRAT_LABEL[poste.type_contrat]} · {poste.nombre_postes} poste(s)
          </p>
        </div>
        {poste.statut === 'ouvert' && canUpdate && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={togglePublier}>
              <Globe size={14} /> {poste.avis_publie ? "Dépublier l'offre" : "Publier l'offre"}
            </button>
            <button className="btn-ghost" onClick={() => changerStatut('pourvu')}>Marquer pourvu</button>
            <button className="btn-ghost" onClick={() => changerStatut('annule')}>Annuler</button>
          </div>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {poste.avis_publie && (
        <section className="card mb-6 flex flex-wrap items-center justify-between gap-3 border-hq-blue-light bg-hq-blue-light/30 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-hq-blue">Offre publiée</p>
            <p className="truncate text-sm text-slate-600">{publicLink}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="btn-ghost !py-1.5 text-xs" onClick={copierLien}><Copy size={13} /> Copier le lien</button>
            <button className="btn-ghost !py-1.5 text-xs" onClick={partagerFacebook}><Share2 size={13} /> Partager sur Facebook</button>
          </div>
        </section>
      )}

      {poste.description && (
        <section className="card mb-6 p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Description</h2>
          <p className="text-sm text-slate-600">{poste.description}</p>
        </section>
      )}

      <div className="mb-6">
        <AttachmentsPanel moduleCode="rh" entityType="poste" entityId={id} canDelete />
        <p className="mt-1 text-xs text-slate-400">Ces documents sont visibles publiquement une fois l'offre publiée.</p>
      </div>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Candidats</h2>
          <div className="flex flex-wrap gap-2">
            {selected.size > 0 && canCreate && (
              <button className="btn-ghost !py-1.5 text-xs" onClick={() => setGroupeOpen(true)}>
                <Users size={14} /> Entretien groupé ({selected.size})
              </button>
            )}
            {canCreate && (
              <button className="btn-ghost !py-1.5 text-xs" onClick={() => setOpen(true)}>
                <Plus size={14} /> Nouveau candidat
              </button>
            )}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              {canCreate && <th className="w-8 py-2"></th>}
              <th className="py-2">N°</th>
              <th className="py-2">Candidat</th>
              <th className="py-2">Contact</th>
              <th className="py-2">Source</th>
              <th className="py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {poste.candidats.map((c) => (
              <tr key={c.id} className="cursor-pointer hover:bg-hq-blue-light/40">
                {canCreate && (
                  <td className="py-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                  </td>
                )}
                <td className="py-2 text-slate-700" onClick={() => navigate(`/modules/rh/candidats/${c.id}`)}>{c.numero}</td>
                <td className="py-2 text-slate-700" onClick={() => navigate(`/modules/rh/candidats/${c.id}`)}>{c.nom} {c.prenom}</td>
                <td className="py-2 text-slate-500" onClick={() => navigate(`/modules/rh/candidats/${c.id}`)}>{c.email || c.telephone || '—'}</td>
                <td className="py-2 text-slate-500" onClick={() => navigate(`/modules/rh/candidats/${c.id}`)}>{c.source || '—'}</td>
                <td className="py-2" onClick={() => navigate(`/modules/rh/candidats/${c.id}`)}><StatusBadge status={c.statut} map={CANDIDAT_STATUT} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {poste.candidats.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Aucun candidat pour ce poste.</p>}
      </section>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau candidat">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nom</label>
              <input className="input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
            <div>
              <label className="label">Prénom</label>
              <input className="input" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">E-mail</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Source</label>
            <input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Ex. Cooptation, site carrière…" />
          </div>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.nom.trim() || !form.prenom.trim()}
          >
            Enregistrer
          </button>
        </div>
      </SlideOver>

      <SlideOver open={groupeOpen} onClose={() => setGroupeOpen(false)} title={`Entretien groupé (${selected.size} candidat${selected.size > 1 ? 's' : ''})`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={groupeForm.date_entretien} onChange={(e) => setGroupeForm({ ...groupeForm, date_entretien: e.target.value })} />
            </div>
            <div>
              <label className="label">Heure de début</label>
              <input className="input" type="time" value={groupeForm.heure_debut} onChange={(e) => setGroupeForm({ ...groupeForm, heure_debut: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Heure de fin</label>
            <input className="input" type="time" value={groupeForm.heure_fin} onChange={(e) => setGroupeForm({ ...groupeForm, heure_fin: e.target.value })} />
          </div>
          <div>
            <label className="label">Évaluateur</label>
            <select className="input" value={groupeForm.evaluateur_id} onChange={(e) => setGroupeForm({ ...groupeForm, evaluateur_id: e.target.value })}>
              <option value="">Non assigné</option>
              {employes.map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Mode</label>
            <select className="input" value={groupeForm.mode} onChange={(e) => setGroupeForm({ ...groupeForm, mode: e.target.value })}>
              <option value="presentiel">Présentiel</option>
              <option value="visio">Visio</option>
            </select>
          </div>
          {googleStatus.connected && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={groupeForm.generer_meet} onChange={(e) => setGroupeForm({ ...groupeForm, generer_meet: e.target.checked })} />
              Générer un lien Google Meet (un seul lien, partagé par le groupe)
            </label>
          )}
          <p className="text-xs text-slate-400">Chaque candidat sélectionné recevra une invitation individuelle par e-mail.</p>
          <button className="btn-primary w-full" onClick={submitGroupe} disabled={!groupeForm.date_entretien}>
            Planifier pour {selected.size} candidat{selected.size > 1 ? 's' : ''}
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

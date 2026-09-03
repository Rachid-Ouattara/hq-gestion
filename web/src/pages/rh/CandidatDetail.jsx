import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Mail, Plus, Video } from 'lucide-react';
import { get, patch, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { CANDIDAT_STATUT, ENTRETIEN_STATUT } from './statusMaps.js';

const FUNNEL = ['recu', 'preselection', 'entretien', 'offre', 'embauche'];

const EMPTY_ENTRETIEN = { date_entretien: '', heure_debut: '', evaluateur_id: '', mode: 'presentiel', generer_meet: false };
const EMPTY_EMBAUCHE = { matricule: '', date_embauche: '', salaire_base: '0' };

export default function CandidatDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [candidat, setCandidat] = useState(null);
  const [error, setError] = useState('');
  const [employes, setEmployes] = useState([]);
  const [googleStatus, setGoogleStatus] = useState({ connected: false });

  const [entretienOpen, setEntretienOpen] = useState(false);
  const [entretienForm, setEntretienForm] = useState(EMPTY_ENTRETIEN);

  const [embaucheOpen, setEmbaucheOpen] = useState(false);
  const [embaucheForm, setEmbaucheForm] = useState(EMPTY_EMBAUCHE);

  const [realiseFor, setRealiseFor] = useState(null);
  const [realiseScore, setRealiseScore] = useState('');
  const [realiseCommentaire, setRealiseCommentaire] = useState('');

  const canCreate = can('rh', 'create');
  const canUpdate = can('rh', 'update');

  const load = useCallback(() => {
    get(`/rh/candidats/${id}`).then(setCandidat).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { get('/rh/employes?statut=actif').then(setEmployes).catch(() => {}); }, []);
  useEffect(() => { get('/rh/google/status').then(setGoogleStatus).catch(() => {}); }, []);

  const changerStatut = async (statut) => {
    try {
      await patch(`/rh/candidats/${id}/statut`, { statut });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const submitEntretien = async () => {
    try {
      await post(`/rh/candidats/${id}/entretiens`, entretienForm);
      setEntretienForm(EMPTY_ENTRETIEN);
      setEntretienOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const ouvrirRealise = (entretien) => {
    setRealiseFor(entretien.id);
    setRealiseScore(entretien.score ?? '');
    setRealiseCommentaire(entretien.commentaire ?? '');
  };

  const confirmerRealise = async (entretienId) => {
    try {
      await patch(`/rh/candidats/entretiens/${entretienId}`, {
        statut: 'realise',
        score: realiseScore === '' ? undefined : Number(realiseScore),
        commentaire: realiseCommentaire || undefined,
      });
      setRealiseFor(null);
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const renvoyerInvitation = async (entretienId) => {
    try {
      await post(`/rh/candidats/entretiens/${entretienId}/envoyer-invitation`, {});
      toast.success('Invitation renvoyée');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const submitEmbauche = async () => {
    try {
      const employe = await post(`/rh/candidats/${id}/embaucher`, { ...embaucheForm, salaire_base: Number(embaucheForm.salaire_base) });
      setEmbaucheOpen(false);
      toast.success(`${employe.nom} ${employe.prenom} ajouté au personnel`);
      navigate('/modules/rh/employes');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!candidat) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  const funnelIndex = FUNNEL.indexOf(candidat.statut);
  const isClosed = candidat.statut === 'embauche' || candidat.statut === 'refuse';

  return (
    <div>
      <button onClick={() => navigate(`/modules/rh/recrutement/${candidat.poste_id}`)} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour au poste
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{candidat.nom} {candidat.prenom}</h1>
            <StatusBadge status={candidat.statut} map={CANDIDAT_STATUT} />
          </div>
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <Briefcase size={14} /> {candidat.numero} · {candidat.poste_titre}
          </p>
        </div>
        {!isClosed && canCreate && (
          <button className="btn-accent" onClick={() => setEmbaucheOpen(true)}>Embaucher</button>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {!isClosed && canUpdate && (
        <section className="card mb-6 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Faire progresser</h2>
          <div className="flex flex-wrap items-center gap-2">
            {FUNNEL.map((stage, i) => (
              <button
                key={stage}
                onClick={() => changerStatut(stage)}
                disabled={stage === 'embauche'}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  i <= funnelIndex ? 'bg-hq-blue text-white' : 'border border-slate-300 text-slate-500 hover:bg-slate-50'
                } ${stage === 'embauche' ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {CANDIDAT_STATUT[stage].label}
              </button>
            ))}
            <span className="text-slate-300">|</span>
            <button onClick={() => changerStatut('refuse')} className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
              Refuser
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Informations</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-400">E-mail</dt><dd className="text-slate-700">{candidat.email || '—'}</dd></div>
            <div><dt className="text-slate-400">Téléphone</dt><dd className="text-slate-700">{candidat.telephone || '—'}</dd></div>
            <div><dt className="text-slate-400">Source</dt><dd className="text-slate-700">{candidat.source || '—'}</dd></div>
          </dl>
          {candidat.notes && <p className="mt-3 text-sm text-slate-600">{candidat.notes}</p>}
        </section>
      </div>

      <section className="card mt-6 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Entretiens</h2>
          {canCreate && (
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setEntretienOpen(true)}>
              <Plus size={14} /> Nouvel entretien
            </button>
          )}
        </div>
        <div className="space-y-3">
          {candidat.entretiens.map((en) => (
            <div key={en.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-700">
                  {new Date(en.date_entretien).toLocaleDateString('fr-FR')}
                  {en.heure_debut ? ` · ${en.heure_debut.slice(0, 5)}` : ''} · {en.mode === 'visio' ? 'Visio' : 'Présentiel'}
                </span>
                <StatusBadge status={en.statut} map={ENTRETIEN_STATUT} />
              </div>
              <p className="text-xs text-slate-400">
                Évaluateur : {en.evaluateur_nom ? `${en.evaluateur_nom} ${en.evaluateur_prenom}` : 'Non assigné'}
              </p>
              {en.meet_link && (
                <a href={en.meet_link} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-xs text-hq-cyan hover:text-hq-cyan-dark">
                  <Video size={13} /> Rejoindre sur Google Meet
                </a>
              )}
              {en.score != null && <p className="mt-1 text-xs text-slate-500">Score : {en.score}/20</p>}
              {en.commentaire && <p className="mt-1 text-slate-600">{en.commentaire}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {en.statut === 'planifie' && canUpdate && realiseFor !== en.id && (
                  <button className="text-xs text-hq-cyan hover:text-hq-cyan-dark" onClick={() => ouvrirRealise(en)}>
                    Marquer comme réalisé
                  </button>
                )}
                {candidat.email && canUpdate && (
                  <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-hq-blue" onClick={() => renvoyerInvitation(en.id)}>
                    <Mail size={12} /> Renvoyer l'invitation
                  </button>
                )}
              </div>
              {realiseFor === en.id && (
                <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Score /20</label>
                      <input className="input" type="number" min="0" max="20" value={realiseScore} onChange={(ev) => setRealiseScore(ev.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Commentaire</label>
                    <textarea className="input" rows={2} value={realiseCommentaire} onChange={(ev) => setRealiseCommentaire(ev.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary !py-1.5 text-xs" onClick={() => confirmerRealise(en.id)}>Enregistrer</button>
                    <button className="btn-ghost !py-1.5 text-xs" onClick={() => setRealiseFor(null)}>Annuler</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {candidat.entretiens.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Aucun entretien planifié.</p>}
        </div>
      </section>

      <div className="mt-6">
        <AttachmentsPanel moduleCode="rh" entityType="candidat" entityId={id} />
      </div>

      <SlideOver open={entretienOpen} onClose={() => setEntretienOpen(false)} title="Nouvel entretien">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={entretienForm.date_entretien} onChange={(e) => setEntretienForm({ ...entretienForm, date_entretien: e.target.value })} />
            </div>
            <div>
              <label className="label">Heure</label>
              <input className="input" type="time" value={entretienForm.heure_debut} onChange={(e) => setEntretienForm({ ...entretienForm, heure_debut: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Évaluateur</label>
            <select className="input" value={entretienForm.evaluateur_id} onChange={(e) => setEntretienForm({ ...entretienForm, evaluateur_id: e.target.value })}>
              <option value="">Non assigné</option>
              {employes.map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Mode</label>
            <select className="input" value={entretienForm.mode} onChange={(e) => setEntretienForm({ ...entretienForm, mode: e.target.value })}>
              <option value="presentiel">Présentiel</option>
              <option value="visio">Visio</option>
            </select>
          </div>
          {googleStatus.connected && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={entretienForm.generer_meet} onChange={(e) => setEntretienForm({ ...entretienForm, generer_meet: e.target.checked })} />
              Générer un lien Google Meet
            </label>
          )}
          {candidat.email && (
            <p className="text-xs text-slate-400">Une invitation par e-mail sera envoyée à {candidat.email}.</p>
          )}
          <button className="btn-primary w-full" onClick={submitEntretien} disabled={!entretienForm.date_entretien}>
            Planifier
          </button>
        </div>
      </SlideOver>

      <SlideOver open={embaucheOpen} onClose={() => setEmbaucheOpen(false)} title="Embaucher ce candidat">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Créera la fiche employé de {candidat.nom} {candidat.prenom} pour le poste « {candidat.poste_titre} ».
          </p>
          <div>
            <label className="label">Matricule</label>
            <input className="input" value={embaucheForm.matricule} onChange={(e) => setEmbaucheForm({ ...embaucheForm, matricule: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date d'embauche</label>
              <input className="input" type="date" value={embaucheForm.date_embauche} onChange={(e) => setEmbaucheForm({ ...embaucheForm, date_embauche: e.target.value })} />
            </div>
            <div>
              <label className="label">Salaire de base</label>
              <input className="input" type="number" min="0" value={embaucheForm.salaire_base} onChange={(e) => setEmbaucheForm({ ...embaucheForm, salaire_base: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary w-full" onClick={submitEmbauche} disabled={!embaucheForm.matricule.trim()}>
            Confirmer l'embauche
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

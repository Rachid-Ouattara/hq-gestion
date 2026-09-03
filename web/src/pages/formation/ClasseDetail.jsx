import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { DOMAINE_LABEL } from './statusMaps.js';

const EMPTY_FORM = { titre: '', description: '', ordre: '' };

export default function ClasseDetail() {
  const { ecoleId, classeId } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [classe, setClasse] = useState(null);
  const [domaine, setDomaine] = useState('ia');
  const [chapitres, setChapitres] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const canCreate = can('formation', 'create');

  const load = useCallback(() => {
    get(`/formation/ecoles/${ecoleId}/classes/${classeId}`).then(setClasse).catch((e) => setError(e.message));
  }, [ecoleId, classeId]);

  useEffect(() => { load(); }, [load]);

  const loadChapitres = useCallback(() => {
    get(`/formation/chapitres?classe_id=${classeId}&domaine=${domaine}`).then(setChapitres).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId, domaine]);

  useEffect(() => { loadChapitres(); }, [loadChapitres]);

  const submit = async () => {
    try {
      await post('/formation/chapitres', {
        classe_id: classeId,
        domaine,
        titre: form.titre,
        description: form.description,
        ordre: form.ordre === '' ? undefined : Number(form.ordre),
      });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      loadChapitres();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!classe) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  // Un chapitre est "en avance" (hors canevas) si un chapitre d'ordre supérieur est couvert
  // alors que lui ne l'est pas encore — indice que le formateur ne suit pas l'ordre du canevas.
  const maxOrdreCouvert = chapitres ? Math.max(0, ...chapitres.filter((c) => c.couvert).map((c) => c.ordre)) : 0;

  return (
    <div>
      <button onClick={() => navigate(`/modules/formation/ecoles/${ecoleId}`)} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour à {classe.ecole_nom}
      </button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-hq-blue">{classe.nom}</h1>
        <p className="text-sm text-slate-500">{classe.ecole_nom}</p>
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-300 p-0.5">
          {Object.entries(DOMAINE_LABEL).map(([code, label]) => (
            <button
              key={code}
              onClick={() => setDomaine(code)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                domaine === code ? 'bg-hq-blue text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {canCreate && (
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => setOpen(true)}>
            <Plus size={14} /> Nouveau chapitre
          </button>
        )}
      </div>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Canevas — {DOMAINE_LABEL[domaine]}
        </h2>
        {!chapitres ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {chapitres.map((c) => {
              const enAvanceSurCelui = !c.couvert && c.ordre < maxOrdreCouvert;
              const isExpanded = expandedId === c.id;
              return (
                <div key={c.id}>
                  <button
                    className="flex w-full items-center justify-between gap-3 py-3 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">{c.ordre}. {c.titre}</span>
                      {enAvanceSurCelui && (
                        <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                          <AlertTriangle size={12} /> Sauté ?
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {c.couvert ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 size={12} /> Couvert le {new Date(c.derniere_couverture).toLocaleDateString('fr-FR')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Non couvert</span>
                      )}
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="pb-4 pl-1">
                      {c.description && <p className="mb-3 text-sm text-slate-600">{c.description}</p>}
                      <AttachmentsPanel moduleCode="formation" entityType="chapitre" entityId={c.id} />
                    </div>
                  )}
                </div>
              );
            })}
            {chapitres.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">Aucun chapitre défini pour ce domaine.</p>
            )}
          </div>
        )}
      </section>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau chapitre">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Domaine : {DOMAINE_LABEL[domaine]}</p>
          <div>
            <label className="label">Titre</label>
            <input className="input" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Ex. Introduction aux réseaux de neurones" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Ordre</label>
            <input className="input" type="number" min="0" value={form.ordre} onChange={(e) => setForm({ ...form, ordre: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.titre.trim()}>Enregistrer</button>
        </div>
      </SlideOver>
    </div>
  );
}

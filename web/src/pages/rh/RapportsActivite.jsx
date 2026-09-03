import { useEffect, useState } from 'react';
import { CheckCircle2, Plus, Send, XCircle } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import { RAPPORT_ACTIVITE_STATUT } from './statusMaps.js';

const EMPTY_FORM = { periode_debut: '', periode_fin: '', contenu: '', difficultes: '' };

export default function RapportsActivite() {
  const { user, can } = useAuth();
  const toast = useToast();
  const isStaff = !['formateur', 'employe'].includes(user?.role);
  const canDecide = can('rh', 'validate');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [comments, setComments] = useState({});
  const [decisions, setDecisions] = useState({});

  const load = () => get('/rh/rapports-activite').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!isStaff) get('/rh/employes/me').then(setMe).catch(() => {}); }, [isStaff]);

  const submit = async () => {
    try {
      await post('/rh/rapports-activite', form);
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const soumettre = async (id) => {
    try {
      await post(`/rh/rapports-activite/${id}/soumettre`, {});
      toast.success('Soumis');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const commenter = async (id) => {
    try {
      await post(`/rh/rapports-activite/${id}/commenter`, { commentaire_responsable: comments[id] || '' });
      toast.success('Marqué comme lu');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const decider = async (id, decision) => {
    try {
      await post(`/rh/rapports-activite/${id}/decider`, { decision, comment: decisions[id] || '' });
      toast.success(decision === 'validated' ? 'Validé' : 'Rejeté');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const subordinateIds = me?.subordinate_ids || [];
  const mesRapports = isStaff ? [] : rows.filter((r) => r.employe_id === me?.id);
  const equipeRapports = isStaff ? [] : rows.filter((r) => subordinateIds.includes(r.employe_id));

  const renderCard = (r, { showSubmit = false, showComment = false, showDecide = false } = {}) => (
    <div key={r.id} className="card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-slate-700">{r.numero}</span>
          <span className="ml-2 text-sm text-slate-400">
            {new Date(r.periode_debut).toLocaleDateString('fr-FR')} → {new Date(r.periode_fin).toLocaleDateString('fr-FR')}
            {(isStaff || showComment) ? ` · ${r.employe_nom} ${r.employe_prenom}` : ''}
          </span>
        </div>
        <StatusBadge status={r.statut} map={RAPPORT_ACTIVITE_STATUT} />
      </div>
      <p className="text-sm text-slate-600">{r.contenu}</p>
      {r.difficultes && <p className="mt-1 text-sm text-hq-orange-dark">Difficultés : {r.difficultes}</p>}
      {r.commentaire_responsable && (
        <div className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
          <span className="font-medium">Commentaire du responsable :</span> {r.commentaire_responsable}
        </div>
      )}

      {showSubmit && r.statut === 'brouillon' && (
        <button className="btn-accent mt-3" onClick={() => soumettre(r.id)}>
          <Send size={16} /> Soumettre
        </button>
      )}

      {showComment && r.statut === 'soumis' && (
        <div className="mt-3 flex gap-2">
          <input
            className="input"
            placeholder="Commentaire (optionnel)"
            value={comments[r.id] || ''}
            onChange={(e) => setComments({ ...comments, [r.id]: e.target.value })}
          />
          <button className="btn-primary shrink-0" onClick={() => commenter(r.id)}>Marquer comme lu</button>
        </div>
      )}

      {showDecide && canDecide && r.statut === 'soumis' && (
        <div className="mt-3 space-y-2">
          <input
            className="input"
            placeholder="Commentaire (optionnel)"
            value={decisions[r.id] || ''}
            onChange={(e) => setDecisions({ ...decisions, [r.id]: e.target.value })}
          />
          <div className="flex gap-2">
            <button className="btn flex-1 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => decider(r.id, 'validated')}>
              <CheckCircle2 size={16} /> Valider
            </button>
            <button className="btn flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50" onClick={() => decider(r.id, 'rejected')}>
              <XCircle size={16} /> Rejeter
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-4">
            <Skeleton className="mb-2 h-4 w-48" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {!isStaff && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{mesRapports.length} rapport(s)</p>
            <button className="btn-primary" onClick={() => setOpen(true)}>
              <Plus size={18} /> Nouveau rapport
            </button>
          </div>
          <div className="space-y-3">
            {mesRapports.map((r) => renderCard(r, { showSubmit: true }))}
            {mesRapports.length === 0 && <div className="card p-8 text-center text-sm text-slate-400">Aucun rapport d'activité.</div>}
          </div>

          {subordinateIds.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-slate-400">Rapports de mon équipe</h2>
              <div className="space-y-3">
                {equipeRapports.map((r) => renderCard(r, { showComment: true }))}
                {equipeRapports.length === 0 && <div className="card p-8 text-center text-sm text-slate-400">Aucun rapport reçu.</div>}
              </div>
            </>
          )}
        </>
      )}

      {isStaff && (
        <>
          <p className="mb-4 text-sm text-slate-500">{rows.length} rapport(s)</p>
          <div className="space-y-3">
            {rows.map((r) => renderCard(r, { showDecide: true }))}
            {rows.length === 0 && <div className="card p-8 text-center text-sm text-slate-400">Aucun rapport d'activité.</div>}
          </div>
        </>
      )}

      {!isStaff && (
        <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau rapport d'activité">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Période — du</label>
                <input className="input" type="date" value={form.periode_debut} onChange={(e) => setForm({ ...form, periode_debut: e.target.value })} />
              </div>
              <div>
                <label className="label">Période — au</label>
                <input className="input" type="date" value={form.periode_fin} onChange={(e) => setForm({ ...form, periode_fin: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Contenu de l'activité</label>
              <textarea className="input" rows={4} value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} />
            </div>
            <div>
              <label className="label">Difficultés rencontrées</label>
              <textarea className="input" rows={2} value={form.difficultes} onChange={(e) => setForm({ ...form, difficultes: e.target.value })} />
            </div>
            <button className="btn-primary w-full" onClick={submit} disabled={!form.periode_debut || !form.periode_fin || !form.contenu.trim()}>
              Enregistrer en brouillon
            </button>
          </div>
        </SlideOver>
      )}
    </div>
  );
}

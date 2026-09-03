import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { get, patch, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { CANDIDAT_STATUT, POSTE_STATUT, TYPE_CONTRAT_LABEL } from './statusMaps.js';

const EMPTY_FORM = { nom: '', prenom: '', email: '', telephone: '', source: '' };

export default function PosteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [poste, setPoste] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('rh', 'create');
  const canUpdate = can('rh', 'update');

  const load = useCallback(() => {
    get(`/rh/postes/${id}`).then(setPoste).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => changerStatut('pourvu')}>Marquer pourvu</button>
            <button className="btn-ghost" onClick={() => changerStatut('annule')}>Annuler</button>
          </div>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {poste.description && (
        <section className="card mb-6 p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Description</h2>
          <p className="text-sm text-slate-600">{poste.description}</p>
        </section>
      )}

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Candidats</h2>
          {canCreate && (
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setOpen(true)}>
              <Plus size={14} /> Nouveau candidat
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-2">N°</th>
              <th className="py-2">Candidat</th>
              <th className="py-2">Contact</th>
              <th className="py-2">Source</th>
              <th className="py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {poste.candidats.map((c) => (
              <tr key={c.id} className="cursor-pointer hover:bg-hq-blue-light/40" onClick={() => navigate(`/modules/rh/candidats/${c.id}`)}>
                <td className="py-2 text-slate-700">{c.numero}</td>
                <td className="py-2 text-slate-700">{c.nom} {c.prenom}</td>
                <td className="py-2 text-slate-500">{c.email || c.telephone || '—'}</td>
                <td className="py-2 text-slate-500">{c.source || '—'}</td>
                <td className="py-2"><StatusBadge status={c.statut} map={CANDIDAT_STATUT} /></td>
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
    </div>
  );
}

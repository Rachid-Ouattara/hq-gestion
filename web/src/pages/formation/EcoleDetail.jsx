import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { ECOLE_STATUT } from './statusMaps.js';

const EMPTY_FORM = { nom: '', capacite: '' };
const EMPTY_CLASSE_FORM = { nom: '', notes: '' };

export default function EcoleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [ecole, setEcole] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [classeOpen, setClasseOpen] = useState(false);
  const [classeForm, setClasseForm] = useState(EMPTY_CLASSE_FORM);
  const [error, setError] = useState('');

  const canCreate = can('formation', 'create');

  const load = useCallback(() => {
    get(`/formation/ecoles/${id}`).then(setEcole).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    try {
      await post(`/formation/ecoles/${id}/salles`, { ...form, capacite: form.capacite || null });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const submitClasse = async () => {
    try {
      await post(`/formation/ecoles/${id}/classes`, classeForm);
      setClasseForm(EMPTY_CLASSE_FORM);
      setClasseOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!ecole) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/formation/ecoles')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux écoles
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{ecole.nom}</h1>
            <StatusBadge status={ecole.statut_partenariat} map={ECOLE_STATUT} />
          </div>
          <p className="text-sm text-slate-500">{ecole.ville}{ecole.contact_nom ? ` · ${ecole.contact_nom}` : ''}{ecole.contact_telephone ? ` · ${ecole.contact_telephone}` : ''}</p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle salle
          </button>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Salles équipées</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-2">Salle</th>
              <th className="py-2">Capacité</th>
              <th className="py-2">Équipements</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ecole.salles.map((s) => (
              <tr
                key={s.id}
                className="cursor-pointer hover:bg-hq-blue-light/40"
                onClick={() => navigate(`/modules/formation/ecoles/${id}/salles/${s.id}`)}
              >
                <td className="py-2 text-hq-blue">{s.nom}</td>
                <td className="py-2">{s.capacite || '—'}</td>
                <td className="py-2">{s.nb_equipements}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ecole.salles.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Aucune salle enregistrée.</p>}
      </section>

      <section className="card mt-6 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Classes</h2>
          {canCreate && (
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setClasseOpen(true)}>
              <Plus size={14} /> Nouvelle classe
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-2">Classe</th>
              <th className="py-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ecole.classes.map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer hover:bg-hq-blue-light/40"
                onClick={() => navigate(`/modules/formation/ecoles/${id}/classes/${c.id}`)}
              >
                <td className="py-2 text-hq-blue">{c.nom}</td>
                <td className="py-2 text-slate-500">{c.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ecole.classes.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Aucune classe enregistrée.</p>}
      </section>

      <div className="mt-6">
        <AttachmentsPanel moduleCode="formation" entityType="ecole" entityId={id} />
      </div>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle salle">
        <div className="space-y-3">
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex. Salle info 1" />
          </div>
          <div>
            <label className="label">Capacité</label>
            <input className="input" type="number" min="1" value={form.capacite} onChange={(e) => setForm({ ...form, capacite: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.nom.trim()}>Enregistrer</button>
        </div>
      </SlideOver>

      <SlideOver open={classeOpen} onClose={() => setClasseOpen(false)} title="Nouvelle classe">
        <div className="space-y-3">
          <div>
            <label className="label">Nom</label>
            <input className="input" value={classeForm.nom} onChange={(e) => setClasseForm({ ...classeForm, nom: e.target.value })} placeholder="Ex. Terminale S" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={classeForm.notes} onChange={(e) => setClasseForm({ ...classeForm, notes: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submitClasse} disabled={!classeForm.nom.trim()}>Enregistrer</button>
        </div>
      </SlideOver>
    </div>
  );
}

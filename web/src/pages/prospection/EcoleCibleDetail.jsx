import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRightCircle, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { get, patch, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { ECOLE_CIBLE_STATUT } from './statusMaps.js';

const EMPTY_RAPPORT = { resume: '', resultat: '', prochaine_action: '', date_relance: '' };

export default function EcoleCibleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [ecole, setEcole] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [rapportForm, setRapportForm] = useState(EMPTY_RAPPORT);
  const [expandedId, setExpandedId] = useState(null);

  const canUpdate = can('prospection', 'update');
  const canCreate = can('prospection', 'create');

  const load = useCallback(() => {
    get(`/prospection/ecoles-cibles/${id}`).then(setEcole).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const changerStatut = async (statut) => {
    try {
      await patch(`/prospection/ecoles-cibles/${id}/statut`, { statut });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const submitRapport = async () => {
    try {
      await post('/prospection/rapports', { ecole_cible_id: id, ...rapportForm });
      setRapportForm(EMPTY_RAPPORT);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const convertir = async () => {
    try {
      const fe = await post(`/prospection/ecoles-cibles/${id}/convertir`, {});
      toast.success('Mis à jour');
      load();
      navigate(`/modules/formation/ecoles/${fe.id}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!ecole) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/prospection/ecoles-cibles')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux écoles ciblées
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{ecole.nom}</h1>
            <StatusBadge status={ecole.statut} map={ECOLE_CIBLE_STATUT} />
          </div>
          <p className="text-sm text-slate-500">
            {ecole.ville || 'Ville non renseignée'} · {ecole.campagne_nom}{ecole.groupe_nom ? ` · ${ecole.groupe_nom}` : ''}
          </p>
        </div>
        {ecole.ecole_partenaire_id ? (
          <button className="btn-ghost" onClick={() => navigate(`/modules/formation/ecoles/${ecole.ecole_partenaire_id}`)}>
            Voir la fiche école →
          </button>
        ) : (
          ecole.statut === 'partenaire' && canUpdate && (
            <button className="btn-accent" onClick={convertir}>
              <ArrowRightCircle size={16} /> Convertir en école partenaire
            </button>
          )
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Informations</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-400">Contact</dt><dd className="text-slate-700">{ecole.contact_nom || '—'}</dd></div>
            <div><dt className="text-slate-400">Téléphone</dt><dd className="text-slate-700">{ecole.contact_telephone || '—'}</dd></div>
            <div><dt className="text-slate-400">E-mail</dt><dd className="text-slate-700">{ecole.contact_email || '—'}</dd></div>
          </dl>
          {ecole.notes && <p className="mt-3 text-sm text-slate-600">{ecole.notes}</p>}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Statut</h2>
          {canUpdate ? (
            <select className="input" value={ecole.statut} onChange={(e) => changerStatut(e.target.value)}>
              {Object.entries(ECOLE_CIBLE_STATUT).map(([code, s]) => (
                <option key={code} value={code}>{s.label}</option>
              ))}
            </select>
          ) : (
            <StatusBadge status={ecole.statut} map={ECOLE_CIBLE_STATUT} />
          )}
          {ecole.date_relance && (() => {
            const overdue = new Date(ecole.date_relance) <= new Date(new Date().toDateString());
            const label = new Date(ecole.date_relance).toLocaleDateString('fr-FR');
            return (
              <p className={`mt-3 flex items-center gap-1 text-sm ${overdue ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                {overdue && <AlertTriangle size={14} />} Prochaine relance : {label}
              </p>
            );
          })()}
        </section>
      </div>

      <section className="card mt-6 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Rapports de visite</h2>
          {canCreate && (
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setOpen(true)}>
              <Plus size={14} /> Nouveau rapport
            </button>
          )}
        </div>
        <div className="space-y-3">
          {ecole.rapports.map((r) => {
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <button className="mb-1 flex w-full items-center justify-between text-left" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                  <span className="font-medium text-slate-700">{r.numero}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    {new Date(r.date_contact).toLocaleDateString('fr-FR')}
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>
                <p className="text-slate-600">{r.resume}</p>
                {r.resultat && <p className="mt-1 text-xs text-slate-500">Résultat : {r.resultat}</p>}
                {r.prochaine_action && <p className="mt-1 text-xs text-hq-orange-dark">Prochaine action : {r.prochaine_action}</p>}
                {isExpanded && (
                  <div className="mt-3">
                    <AttachmentsPanel moduleCode="prospection" entityType="rapport" entityId={r.id} canUpload canDelete />
                  </div>
                )}
              </div>
            );
          })}
          {ecole.rapports.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Aucun rapport de visite.</p>}
        </div>
      </section>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau rapport de visite">
        <div className="space-y-3">
          <div>
            <label className="label">Résumé de la visite/contact</label>
            <textarea className="input" rows={3} value={rapportForm.resume} onChange={(e) => setRapportForm({ ...rapportForm, resume: e.target.value })} />
          </div>
          <div>
            <label className="label">Résultat</label>
            <input className="input" value={rapportForm.resultat} onChange={(e) => setRapportForm({ ...rapportForm, resultat: e.target.value })} />
          </div>
          <div>
            <label className="label">Prochaine action</label>
            <input className="input" value={rapportForm.prochaine_action} onChange={(e) => setRapportForm({ ...rapportForm, prochaine_action: e.target.value })} />
          </div>
          <div>
            <label className="label">Date de relance (optionnel)</label>
            <input className="input" type="date" value={rapportForm.date_relance} onChange={(e) => setRapportForm({ ...rapportForm, date_relance: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submitRapport} disabled={!rapportForm.resume.trim()}>
            Enregistrer le rapport
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

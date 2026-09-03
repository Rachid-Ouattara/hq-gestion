import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Camera, ChevronDown, ChevronUp, LogOut, Plus, RefreshCw } from 'lucide-react';
import { get, patch, post, tokens, uploadFile } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { CONTRAT_STATUT, EMPLOYE_STATUT, TYPE_CONTRAT_LABEL } from './statusMaps.js';

const EMPTY_CONTRAT = { type_contrat: 'cdi', poste: '', date_debut: '', date_fin: '', salaire_base: '0', notes: '' };

export default function EmployeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [employe, setEmploye] = useState(null);
  const [contrats, setContrats] = useState([]);
  const [error, setError] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const [expandedId, setExpandedId] = useState(null);

  const [open, setOpen] = useState(false);
  const [isRenewal, setIsRenewal] = useState(null); // contrat id being renewed, or null for "nouveau"
  const [form, setForm] = useState(EMPTY_CONTRAT);

  const [arrivee, setArrivee] = useState([]);
  const [depart, setDepart] = useState([]);

  const canCreate = can('rh', 'create');
  const canUpdate = can('rh', 'update');

  const load = useCallback(() => {
    get(`/rh/employes/${id}`).then(setEmploye).catch((e) => setError(e.message));
    get(`/rh/contrats?employe_id=${id}`).then(setContrats).catch(() => {});
    get(`/rh/checklists?employe_id=${id}&type=arrivee`).then(setArrivee).catch(() => {});
    get(`/rh/checklists?employe_id=${id}&type=depart`).then(setDepart).catch(() => {});
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!employe?.photo_chemin) { setPhotoUrl(null); return; }
    let objectUrl;
    let cancelled = false;
    fetch(`/api/rh/employes/${employe.id}/photo`, { headers: { Authorization: `Bearer ${tokens.access}` } })
      .then((res) => (res.ok ? res.blob() : Promise.reject()))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [employe?.id, employe?.photo_chemin]);

  const onPhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('fichier', file);
      await uploadFile(`/rh/employes/${id}/photo`, fd);
      toast.success('Photo mise à jour');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const ouvrirNouveauContrat = () => {
    setIsRenewal(null);
    setForm(EMPTY_CONTRAT);
    setOpen(true);
  };

  const ouvrirRenouvellement = (contrat) => {
    setIsRenewal(contrat.id);
    setForm({
      type_contrat: contrat.type_contrat,
      poste: contrat.poste || '',
      date_debut: '',
      date_fin: '',
      salaire_base: String(contrat.salaire_base),
      notes: '',
    });
    setOpen(true);
  };

  const submitContrat = async () => {
    try {
      const payload = { ...form, salaire_base: Number(form.salaire_base) };
      if (isRenewal) {
        await post(`/rh/contrats/${isRenewal}/renouveler`, payload);
      } else {
        await post('/rh/contrats', { ...payload, employe_id: id });
      }
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const changerStatutContrat = async (contratId, statut) => {
    try {
      await patch(`/rh/contrats/${contratId}/statut`, { statut });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const changerStatutEmploye = async (statut) => {
    try {
      await patch(`/rh/employes/${id}/statut`, { statut });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleChecklistItem = async (item) => {
    try {
      await patch(`/rh/checklists/items/${item.id}`, { checked: !item.checked });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const demarrerDepart = async () => {
    try {
      await post(`/rh/checklists/${id}/depart`, {});
      toast.success('Processus de départ démarré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!employe) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/rh/employes')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour au dossier du personnel
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-hq-blue-light text-2xl font-semibold text-hq-blue">
                {photoUrl ? <img src={photoUrl} alt={`${employe.nom} ${employe.prenom}`} className="h-full w-full object-cover" /> : `${employe.nom?.[0] || ''}${employe.prenom?.[0] || ''}`}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoSelected} />
              <button
                className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-hq-orange text-white shadow hover:bg-hq-orange-dark"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                title="Changer la photo"
              >
                <Camera size={14} />
              </button>
            </div>
            <h1 className="mt-3 text-lg font-semibold text-hq-blue">{employe.nom} {employe.prenom}</h1>
            <p className="text-sm text-slate-500">{employe.poste}</p>
            {canUpdate ? (
              <select
                className="input mt-2 !w-auto !py-1 text-xs"
                value={employe.statut}
                onChange={(e) => changerStatutEmploye(e.target.value)}
              >
                {Object.entries(EMPLOYE_STATUT).map(([code, s]) => (
                  <option key={code} value={code}>{s.label}</option>
                ))}
              </select>
            ) : (
              <div className="mt-2"><StatusBadge status={employe.statut} map={EMPLOYE_STATUT} /></div>
            )}
            {employe.responsable_nom && (
              <p className="mt-2 text-xs text-slate-400">Responsable : {employe.responsable_nom} {employe.responsable_prenom}</p>
            )}
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Informations</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-400">Matricule</dt><dd className="text-slate-700">{employe.matricule}</dd></div>
            <div><dt className="text-slate-400">Département</dt><dd className="text-slate-700">{employe.departement || '—'}</dd></div>
            <div><dt className="text-slate-400">Type de contrat</dt><dd className="text-slate-700">{TYPE_CONTRAT_LABEL[employe.type_contrat] || employe.type_contrat}</dd></div>
            <div><dt className="text-slate-400">Date d'embauche</dt><dd className="text-slate-700">{employe.date_embauche ? new Date(employe.date_embauche).toLocaleDateString('fr-FR') : '—'}</dd></div>
            <div><dt className="text-slate-400">Téléphone</dt><dd className="text-slate-700">{employe.telephone || '—'}</dd></div>
            <div><dt className="text-slate-400">E-mail</dt><dd className="text-slate-700">{employe.email || '—'}</dd></div>
            <div className="col-span-2"><dt className="text-slate-400">Adresse</dt><dd className="text-slate-700">{employe.adresse || '—'}</dd></div>
          </dl>
        </section>
      </div>

      <section className="card mt-6 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Contrats</h2>
          {canCreate && (
            <button className="btn-ghost !py-1.5 text-xs" onClick={ouvrirNouveauContrat}>
              <Plus size={14} /> Nouveau contrat
            </button>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {contrats.map((c) => {
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id}>
                <button className="flex w-full items-center justify-between gap-3 py-3 text-left" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{c.numero}</span>
                    <span className="text-xs text-slate-400">{TYPE_CONTRAT_LABEL[c.type_contrat]}</span>
                    {c.echeance_proche && (
                      <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                        <AlertTriangle size={12} /> Échéance proche
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {new Date(c.date_debut).toLocaleDateString('fr-FR')} → {c.date_fin ? new Date(c.date_fin).toLocaleDateString('fr-FR') : 'indéterminée'}
                    </span>
                    <StatusBadge status={c.statut} map={CONTRAT_STATUT} />
                    {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="pb-4 pl-1">
                    <p className="mb-2 text-sm text-slate-600">Salaire de base : {Number(c.salaire_base).toLocaleString('fr-FR')}</p>
                    {c.notes && <p className="mb-2 text-sm text-slate-600">{c.notes}</p>}
                    {c.statut === 'actif' && canCreate && (
                      <div className="mb-3 flex gap-2">
                        <button className="btn-accent !py-1.5 text-xs" onClick={() => ouvrirRenouvellement(c)}>
                          <RefreshCw size={13} /> Renouveler
                        </button>
                        <button className="btn-ghost !py-1.5 text-xs" onClick={() => changerStatutContrat(c.id, 'resilie')}>
                          Résilier
                        </button>
                      </div>
                    )}
                    <AttachmentsPanel moduleCode="rh" entityType="contrat" entityId={c.id} />
                  </div>
                )}
              </div>
            );
          })}
          {contrats.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Aucun contrat enregistré.</p>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card mt-6 p-5">
          <h2 className="mb-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-slate-400">
            Intégration
            <span className="normal-case text-slate-400">{arrivee.filter((i) => i.checked).length}/{arrivee.length} étapes</span>
          </h2>
          <ul className="space-y-2">
            {arrivee.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={item.checked}
                  disabled={!canUpdate}
                  onChange={() => toggleChecklistItem(item)}
                />
                <div>
                  <p className={item.checked ? 'text-slate-400 line-through' : 'text-slate-700'}>{item.label}</p>
                  {item.checked && item.checked_at && (
                    <p className="text-xs text-slate-400">
                      {new Date(item.checked_at).toLocaleDateString('fr-FR')}{item.checked_by_nom ? ` · ${item.checked_by_nom}` : ''}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card mt-6 p-5">
          <h2 className="mb-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-slate-400">
            Départ
            {depart.length > 0 && (
              <span className="normal-case text-slate-400">{depart.filter((i) => i.checked).length}/{depart.length} étapes</span>
            )}
          </h2>
          {depart.length === 0 ? (
            employe.statut !== 'termine' && canCreate ? (
              <button className="btn-ghost !py-1.5 text-xs" onClick={demarrerDepart}>
                <LogOut size={14} /> Démarrer le processus de départ
              </button>
            ) : (
              <p className="text-sm text-slate-400">Aucun processus de départ en cours.</p>
            )
          ) : (
            <ul className="space-y-2">
              {depart.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={item.checked}
                    disabled={!canUpdate}
                    onChange={() => toggleChecklistItem(item)}
                  />
                  <div>
                    <p className={item.checked ? 'text-slate-400 line-through' : 'text-slate-700'}>{item.label}</p>
                    {item.checked && item.checked_at && (
                      <p className="text-xs text-slate-400">
                        {new Date(item.checked_at).toLocaleDateString('fr-FR')}{item.checked_by_nom ? ` · ${item.checked_by_nom}` : ''}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6">
        <AttachmentsPanel moduleCode="rh" entityType="employe" entityId={id} canDelete />
      </div>

      <SlideOver open={open} onClose={() => setOpen(false)} title={isRenewal ? 'Renouveler le contrat' : 'Nouveau contrat'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type de contrat</label>
              <select className="input" value={form.type_contrat} onChange={(e) => setForm({ ...form, type_contrat: e.target.value })}>
                {Object.entries(TYPE_CONTRAT_LABEL).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Poste</label>
              <input className="input" value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date de début</label>
              <input className="input" type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
            </div>
            <div>
              <label className="label">Date de fin (optionnel)</label>
              <input className="input" type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Salaire de base</label>
            <input className="input" type="number" min="0" value={form.salaire_base} onChange={(e) => setForm({ ...form, salaire_base: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submitContrat} disabled={!form.date_debut}>
            {isRenewal ? 'Renouveler' : 'Enregistrer'}
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

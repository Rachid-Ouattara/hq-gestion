import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { get, tokens, uploadFile } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { TYPE_CONTRAT_LABEL } from './statusMaps.js';

export default function MonDossier() {
  const toast = useToast();
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    get('/rh/employes/me').then(setMe).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!me?.photo_chemin) { setPhotoUrl(null); return; }
    let objectUrl;
    let cancelled = false;
    fetch(`/api/rh/employes/${me.id}/photo`, { headers: { Authorization: `Bearer ${tokens.access}` } })
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
  }, [me?.id, me?.photo_chemin]);

  const onPhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('fichier', file);
      await uploadFile(`/rh/employes/${me.id}/photo`, fd);
      toast.success('Photo mise à jour');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (!me) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-hq-blue-light text-2xl font-semibold text-hq-blue">
                {photoUrl ? <img src={photoUrl} alt={`${me.nom} ${me.prenom}`} className="h-full w-full object-cover" /> : `${me.nom?.[0] || ''}${me.prenom?.[0] || ''}`}
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
            <h1 className="mt-3 text-lg font-semibold text-hq-blue">{me.nom} {me.prenom}</h1>
            <p className="text-sm text-slate-500">{me.poste}</p>
            {me.responsable_nom && (
              <p className="mt-2 text-xs text-slate-400">Responsable : {me.responsable_nom} {me.responsable_prenom}</p>
            )}
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Informations</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-400">Matricule</dt><dd className="text-slate-700">{me.matricule}</dd></div>
            <div><dt className="text-slate-400">Département</dt><dd className="text-slate-700">{me.departement || '—'}</dd></div>
            <div><dt className="text-slate-400">Type de contrat</dt><dd className="text-slate-700">{TYPE_CONTRAT_LABEL[me.type_contrat] || me.type_contrat}</dd></div>
            <div><dt className="text-slate-400">Date d'embauche</dt><dd className="text-slate-700">{me.date_embauche ? new Date(me.date_embauche).toLocaleDateString('fr-FR') : '—'}</dd></div>
            <div><dt className="text-slate-400">Téléphone</dt><dd className="text-slate-700">{me.telephone || '—'}</dd></div>
            <div><dt className="text-slate-400">E-mail</dt><dd className="text-slate-700">{me.email || '—'}</dd></div>
            <div className="col-span-2"><dt className="text-slate-400">Adresse</dt><dd className="text-slate-700">{me.adresse || '—'}</dd></div>
          </dl>
        </section>
      </div>

      <div className="mt-6">
        <AttachmentsPanel moduleCode="rh" entityType="employe" entityId={me.id} canUpload canDelete={false} />
      </div>
    </div>
  );
}

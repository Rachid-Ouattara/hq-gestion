import { useEffect, useRef, useState } from 'react';
import { Download, Paperclip, Trash2 } from 'lucide-react';
import { del, get, tokens, uploadFile } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';

function formatSize(bytes) {
  const n = Number(bytes);
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function AttachmentPreview({ pj }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    fetch(`/api/attachments/${pj.id}/download`, { headers: { Authorization: `Bearer ${tokens.access}` } })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('Aperçu indisponible'))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pj.id]);

  if (!src) return null;
  if (pj.type_mime?.startsWith('image/')) {
    return <img src={src} alt={pj.nom_original} className="mb-2 max-h-64 rounded-lg object-contain" />;
  }
  if (pj.type_mime?.startsWith('video/')) {
    return <video src={src} controls className="mb-2 max-h-64 w-full rounded-lg" />;
  }
  return null;
}

export default function AttachmentsPanel({ moduleCode, entityType, entityId, canUpload, canDelete }) {
  const { user } = useAuth();
  const toast = useToast();
  const isStaff = !!user?.is_staff;
  const allowUpload = canUpload ?? isStaff;
  const allowDelete = canDelete ?? isStaff;
  const [rows, setRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    const params = new URLSearchParams({ module_code: moduleCode, entity_type: entityType, entity_id: entityId });
    get(`/attachments?${params}`).then(setRows).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, [moduleCode, entityType, entityId]);

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('fichier', file);
      fd.append('module_code', moduleCode);
      fd.append('entity_type', entityType);
      fd.append('entity_id', entityId);
      await uploadFile('/attachments', fd);
      toast.success('Enregistré');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const download = async (pj) => {
    try {
      const res = await fetch(`/api/attachments/${pj.id}/download`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (!res.ok) throw new Error('Téléchargement impossible');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pj.nom_original;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (pj) => {
    if (!window.confirm(`Supprimer « ${pj.nom_original} » ?`)) return;
    try {
      await del(`/attachments/${pj.id}`);
      toast.success('Supprimé');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Pièces jointes</h2>
        {allowUpload && (
          <>
            <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} />
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Paperclip size={14} /> {uploading ? 'Envoi…' : 'Joindre un fichier'}
            </button>
          </>
        )}
      </div>

      <ul className="divide-y divide-slate-100">
        {rows.map((pj) => (
          <li key={pj.id} className="py-2 text-sm">
            {(pj.type_mime?.startsWith('image/') || pj.type_mime?.startsWith('video/')) && <AttachmentPreview pj={pj} />}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-700">{pj.nom_original}</p>
                <p className="text-xs text-slate-400">
                  {formatSize(pj.taille_octets)} · {pj.uploaded_by_nom || '—'} · {new Date(pj.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded p-1.5 text-slate-400 hover:bg-hq-blue-light hover:text-hq-blue" onClick={() => download(pj)} title="Télécharger">
                  <Download size={16} />
                </button>
                {allowDelete && (
                  <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(pj)} title="Supprimer">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Aucune pièce jointe.</p>}
    </section>
  );
}

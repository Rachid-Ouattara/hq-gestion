import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { DOCUMENT_STATUT, DOCUMENT_TYPE_LABEL } from './statusMaps.js';

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [archives, setArchives] = useState([]);
  const [selectedArchive, setSelectedArchive] = useState('');

  const canUpdate = can('administrative', 'update');

  const load = useCallback(() => {
    get(`/administrative/documents/${id}`).then(setDoc).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { get('/administrative/archives?statut=ouvert').then(setArchives).catch(() => {}); }, []);

  const archiver = async () => {
    if (!selectedArchive) {
      toast.error("Choisissez d'abord un dossier d'archive.");
      return;
    }
    try {
      await post(`/administrative/documents/${id}/archiver`, { archive_id: selectedArchive });
      toast.success('Archivé');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!doc) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/administrative/documents')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux documents
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{doc.titre}</h1>
            <StatusBadge status={doc.statut} map={DOCUMENT_STATUT} />
          </div>
          <p className="text-sm text-slate-500">{doc.numero} · {DOCUMENT_TYPE_LABEL[doc.type_document] || doc.type_document}</p>
        </div>
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Informations</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-400">Date du document</dt><dd className="text-slate-700">{new Date(doc.date_document).toLocaleDateString('fr-FR')}</dd></div>
          <div><dt className="text-slate-400">Date d'expiration</dt><dd className="text-slate-700">{doc.date_expiration ? new Date(doc.date_expiration).toLocaleDateString('fr-FR') : '—'}</dd></div>
          {doc.archive_libelle && (
            <div><dt className="text-slate-400">Dossier d'archive</dt><dd className="text-slate-700">{doc.archive_libelle}</dd></div>
          )}
        </dl>
        {doc.description && <p className="mt-3 text-sm text-slate-600">{doc.description}</p>}
      </section>

      {doc.statut !== 'archive' && canUpdate && (
        <section className="card mb-6 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Archiver</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem]">
              <label className="label">Dossier d'archive</label>
              <select className="input" value={selectedArchive} onChange={(e) => setSelectedArchive(e.target.value)}>
                <option value="">Sélectionner…</option>
                {archives.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.libelle}</option>)}
              </select>
            </div>
            <button className="btn-ghost" onClick={archiver} disabled={archives.length === 0}>Archiver</button>
          </div>
          {archives.length === 0 && <p className="mt-2 text-xs text-slate-400">Aucun dossier d'archive ouvert — créez-en un dans l'onglet Classement & Archivage.</p>}
        </section>
      )}

      <AttachmentsPanel moduleCode="administrative" entityType="document" entityId={id} canDelete />
    </div>
  );
}

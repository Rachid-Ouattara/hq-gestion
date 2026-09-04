import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { ARCHIVE_STATUT } from './statusMaps.js';

export default function ArchiveDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [archive, setArchive] = useState(null);
  const [error, setError] = useState('');

  const canUpdate = can('administrative', 'update');

  const load = useCallback(() => {
    get(`/administrative/archives/${id}`).then(setArchive).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const cloturer = async () => {
    if (!window.confirm(`Clôturer le dossier ${archive.code} ?`)) return;
    try {
      await post(`/administrative/archives/${id}/cloturer`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!archive) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/administrative/archives')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux archives
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{archive.libelle}</h1>
            <StatusBadge status={archive.statut} map={ARCHIVE_STATUT} />
          </div>
          <p className="text-sm text-slate-500">
            {archive.code} · {archive.type_support === 'physique' ? 'Support physique' : 'Support numérique'}
          </p>
        </div>
        {archive.statut === 'ouvert' && canUpdate && (
          <button className="btn-ghost" onClick={cloturer}>Clôturer</button>
        )}
      </header>

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Informations</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-400">Emplacement</dt><dd className="text-slate-700">{archive.emplacement || '—'}</dd></div>
          <div><dt className="text-slate-400">Responsable</dt><dd className="text-slate-700">{archive.responsable_nom || '—'}</dd></div>
          <div><dt className="text-slate-400">Ouvert le</dt><dd className="text-slate-700">{new Date(archive.date_ouverture).toLocaleDateString('fr-FR')}</dd></div>
          {archive.date_cloture && (
            <div><dt className="text-slate-400">Clos le</dt><dd className="text-slate-700">{new Date(archive.date_cloture).toLocaleDateString('fr-FR')}</dd></div>
          )}
        </dl>
        {archive.observations && <p className="mt-3 text-sm text-slate-600">{archive.observations}</p>}
      </section>

      <AttachmentsPanel moduleCode="administrative" entityType="archive" entityId={id} canDelete />
    </div>
  );
}

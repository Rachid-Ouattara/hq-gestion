import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { COURRIER_STATUT } from './statusMaps.js';

const NEXT_STATUT = { nouveau: 'en_traitement', en_traitement: 'traite' };
const NEXT_LABEL = { nouveau: 'Passer en traitement', en_traitement: 'Marquer traité' };

export default function CourrierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [courrier, setCourrier] = useState(null);
  const [error, setError] = useState('');
  const [archives, setArchives] = useState([]);
  const [selectedArchive, setSelectedArchive] = useState('');

  const canUpdate = can('administrative', 'update');

  const load = useCallback(() => {
    get(`/administrative/courrier/${id}`).then(setCourrier).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { get('/administrative/archives?statut=ouvert').then(setArchives).catch(() => {}); }, []);

  const avancer = async () => {
    try {
      await post(`/administrative/courrier/${id}/statut`, { statut: NEXT_STATUT[courrier.statut] });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const archiver = async () => {
    if (!selectedArchive) {
      toast.error("Choisissez d'abord un dossier d'archive.");
      return;
    }
    try {
      await post(`/administrative/courrier/${id}/archiver`, { archive_id: selectedArchive });
      toast.success('Archivé');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!courrier) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  const backTo = courrier.sens === 'entrant' ? 'courrier-entrant' : 'courrier-sortant';

  return (
    <div>
      <button onClick={() => navigate(`/modules/administrative/${backTo}`)} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour au courrier {courrier.sens === 'entrant' ? 'entrant' : 'sortant'}
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{courrier.objet}</h1>
            <StatusBadge status={courrier.statut} map={COURRIER_STATUT} />
          </div>
          <p className="text-sm text-slate-500">{courrier.numero} · {courrier.correspondant}</p>
        </div>
        {canUpdate && (
          <div className="flex flex-wrap gap-2">
            {NEXT_STATUT[courrier.statut] && (
              <button className="btn-primary" onClick={avancer}>{NEXT_LABEL[courrier.statut]}</button>
            )}
          </div>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Informations</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-400">Date</dt><dd className="text-slate-700">{new Date(courrier.date_courrier).toLocaleDateString('fr-FR')}</dd></div>
          <div><dt className="text-slate-400">Mode de transmission</dt><dd className="text-slate-700">{courrier.mode_transmission || '—'}</dd></div>
          <div><dt className="text-slate-400">Traité par</dt><dd className="text-slate-700">{courrier.traite_par_nom || '—'}</dd></div>
          {courrier.archive_libelle && (
            <div><dt className="text-slate-400">Dossier d'archive</dt><dd className="text-slate-700">{courrier.archive_libelle}</dd></div>
          )}
        </dl>
        {courrier.observations && <p className="mt-3 text-sm text-slate-600">{courrier.observations}</p>}
      </section>

      {courrier.statut !== 'archive' && canUpdate && (
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

      <AttachmentsPanel moduleCode="administrative" entityType="courrier" entityId={id} canDelete />
    </div>
  );
}

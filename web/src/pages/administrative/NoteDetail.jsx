import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { NOTE_STATUT } from './statusMaps.js';

export default function NoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [note, setNote] = useState(null);
  const [error, setError] = useState('');

  const canUpdate = can('administrative', 'update');

  const load = useCallback(() => {
    get(`/administrative/notes/${id}`).then(setNote).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const diffuser = async () => {
    if (!window.confirm('Diffuser cette note ? Elle ne pourra plus être modifiée après diffusion.')) return;
    try {
      await post(`/administrative/notes/${id}/diffuser`, {});
      toast.success('Note diffusée');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!note) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/administrative/notes')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux notes
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{note.objet}</h1>
            <StatusBadge status={note.statut} map={NOTE_STATUT} />
          </div>
          <p className="text-sm text-slate-500">{note.numero} · {new Date(note.date_note).toLocaleDateString('fr-FR')}</p>
        </div>
        {note.statut === 'brouillon' && canUpdate && (
          <button className="btn-primary" onClick={diffuser}>Diffuser</button>
        )}
      </header>

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Destinataires</h2>
        <p className="text-sm text-slate-700">{note.destinataires || 'Non précisé'}</p>
      </section>

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Contenu</h2>
        <p className="whitespace-pre-line text-sm text-slate-600">{note.contenu}</p>
      </section>

      <AttachmentsPanel moduleCode="administrative" entityType="note" entityId={id} canDelete />
    </div>
  );
}

import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { get } from '../../lib/api.js';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';
import { DEPENSE_CATEGORIE_LABEL } from './statusMaps.js';

export default function DepenseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [depense, setDepense] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    get(`/finance/depenses/${id}`).then(setDepense).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!depense) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/finance/depenses')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux dépenses
      </button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-hq-blue">{depense.libelle}</h1>
        <p className="text-sm text-slate-500">
          {depense.compte_code} — {depense.compte_libelle} · {DEPENSE_CATEGORIE_LABEL[depense.categorie]} ·{' '}
          {new Date(depense.date_depense).toLocaleDateString('fr-FR')}
        </p>
      </header>

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Détails</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-400">Montant</dt>
            <dd className="text-slate-700">{Number(depense.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Référence</dt>
            <dd className="text-slate-700">{depense.reference || '—'}</dd>
          </div>
        </dl>
      </section>

      <AttachmentsPanel moduleCode="finance" entityType="depense" entityId={id} />
    </div>
  );
}

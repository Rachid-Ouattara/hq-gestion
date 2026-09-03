import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShoppingCart, Send, XCircle } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { DEVIS_STATUS } from './statusMaps.js';

export default function DevisDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [devis, setDevis] = useState(null);
  const [error, setError] = useState('');

  const canUpdate = can('commercial', 'update');
  const canCreate = can('commercial', 'create');

  const load = useCallback(() => {
    get(`/commercial/devis/${id}`).then(setDevis).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const action = async (path) => {
    try {
      await post(`/commercial/devis/${id}/${path}`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const creerCommande = () => navigate(`/modules/commercial/commandes?devis_id=${id}`);

  if (!devis) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/commercial/devis')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux devis
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{devis.numero}</h1>
            <StatusBadge status={devis.statut} map={DEVIS_STATUS} />
          </div>
          <p className="text-sm text-slate-500">{devis.client_nom} — {devis.objet}</p>
        </div>
        <div className="flex gap-2">
          {devis.statut === 'brouillon' && canUpdate && (
            <button className="btn-accent" onClick={() => action('envoyer')}>
              <Send size={16} /> Envoyer au client
            </button>
          )}
          {devis.statut === 'envoye' && canUpdate && (
            <>
              <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => action('accepter')}>
                <CheckCircle2 size={16} /> Marquer accepté
              </button>
              <button className="btn-ghost" onClick={() => action('refuser')}>
                <XCircle size={16} /> Marquer refusé
              </button>
            </>
          )}
          {devis.statut === 'accepte' && canCreate && (
            <button className="btn-primary" onClick={creerCommande}>
              <ShoppingCart size={16} /> Créer une commande
            </button>
          )}
        </div>
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Articles / services</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-2">Désignation</th>
              <th className="py-2">Qté</th>
              <th className="py-2">Unité</th>
              <th className="py-2">Prix unitaire</th>
              <th className="py-2 text-right">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {devis.lignes.map((l) => (
              <tr key={l.id}>
                <td className="py-2">{l.designation}</td>
                <td className="py-2">{l.quantite}</td>
                <td className="py-2">{l.unite || '—'}</td>
                <td className="py-2">{Number(l.prix_unitaire).toLocaleString('fr-FR')}</td>
                <td className="py-2 text-right">{Number(l.montant).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-right text-sm font-semibold text-slate-700">
          Total : {Number(devis.montant_total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
        </p>
      </section>
    </div>
  );
}

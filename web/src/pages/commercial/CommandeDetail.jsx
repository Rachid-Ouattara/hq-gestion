import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, FileText, PackageCheck } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { COMMANDE_STATUS } from './statusMaps.js';

export default function CommandeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [commande, setCommande] = useState(null);
  const [error, setError] = useState('');

  const canUpdate = can('commercial', 'update');
  const canDelete = can('commercial', 'delete');
  const canCreate = can('commercial', 'create');

  const load = useCallback(() => {
    get(`/commercial/commandes/${id}`).then(setCommande).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const action = async (path) => {
    try {
      await post(`/commercial/commandes/${id}/${path}`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const annuler = async () => {
    if (!window.confirm('Annuler cette commande ?')) return;
    action('annuler');
  };

  if (!commande) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/commercial/commandes')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux commandes
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{commande.numero}</h1>
            <StatusBadge status={commande.statut} map={COMMANDE_STATUS} />
          </div>
          <p className="text-sm text-slate-500">{commande.client_nom}{commande.devis_numero ? ` · issue de ${commande.devis_numero}` : ''}</p>
        </div>
        <div className="flex gap-2">
          {commande.statut === 'brouillon' && canUpdate && (
            <button className="btn-primary" onClick={() => action('confirmer')}>Confirmer</button>
          )}
          {commande.statut === 'confirmee' && canUpdate && (
            <button className="btn-primary" onClick={() => action('livrer')}><PackageCheck size={16} /> Marquer livrée</button>
          )}
          {['brouillon', 'confirmee', 'livree'].includes(commande.statut) && canDelete && (
            <button className="btn-ghost" onClick={annuler}><Ban size={16} /> Annuler</button>
          )}
          {['confirmee', 'livree'].includes(commande.statut) && canCreate && (
            <button className="btn-accent" onClick={() => navigate(`/modules/commercial/factures?commande_id=${id}`)}>
              <FileText size={16} /> Facturer
            </button>
          )}
        </div>
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Articles / services</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-2">Désignation</th>
                <th className="py-2">Qté</th>
                <th className="py-2">Prix unitaire</th>
                <th className="py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commande.lignes.map((l) => (
                <tr key={l.id}>
                  <td className="py-2">{l.designation}</td>
                  <td className="py-2">{l.quantite} {l.unite}</td>
                  <td className="py-2">{Number(l.prix_unitaire).toLocaleString('fr-FR')}</td>
                  <td className="py-2 text-right">{Number(l.montant).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-right text-sm font-semibold text-slate-700">
            Total : {Number(commande.montant_total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {commande.devise}
          </p>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Factures</h2>
          {commande.factures.length === 0 && <p className="text-sm text-slate-400">Aucune facture émise.</p>}
          <ul className="space-y-2">
            {commande.factures.map((f) => (
              <li
                key={f.id}
                className="flex cursor-pointer justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-hq-blue-light/40"
                onClick={() => navigate(`/modules/commercial/factures/${f.id}`)}
              >
                <span className="text-slate-600">{f.numero}</span>
                <span className="font-medium text-slate-800">{Number(f.montant_total).toLocaleString('fr-FR')}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

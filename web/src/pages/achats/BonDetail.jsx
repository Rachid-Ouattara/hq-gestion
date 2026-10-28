import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, FileDown, PackageCheck, Send, Wallet } from 'lucide-react';
import { get, post, downloadFile } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { BON_STATUS, PAIEMENT_MODE_LABEL } from './statusMaps.js';

export default function BonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [bon, setBon] = useState(null);
  const [error, setError] = useState('');

  const canUpdate = can('achats', 'update');
  const canDelete = can('achats', 'delete');
  const canCreate = can('achats', 'create');

  const load = useCallback(() => {
    get(`/achats/bons-de-commande/${id}`).then(setBon).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const envoyer = async () => {
    try {
      await post(`/achats/bons-de-commande/${id}/envoyer`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const annuler = async () => {
    if (!window.confirm('Annuler ce bon de commande ?')) return;
    try {
      await post(`/achats/bons-de-commande/${id}/annuler`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const telechargerPdf = async () => {
    try {
      await downloadFile(`/achats/bons-de-commande/${id}/pdf`, `${bon.numero}.pdf`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!bon) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/achats/bons')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux bons de commande
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{bon.numero}</h1>
            <StatusBadge status={bon.statut} map={BON_STATUS} />
          </div>
          <p className="text-sm text-slate-500">{bon.fournisseur_nom}{bon.demande_numero ? ` · issu de ${bon.demande_numero}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={telechargerPdf}><FileDown size={16} /> Télécharger PDF</button>
          {bon.statut === 'brouillon' && canUpdate && (
            <button className="btn-primary" onClick={envoyer}><Send size={16} /> Envoyer</button>
          )}
          {['brouillon', 'envoyee'].includes(bon.statut) && canDelete && (
            <button className="btn-ghost" onClick={annuler}><Ban size={16} /> Annuler</button>
          )}
          {['envoyee', 'receptionnee_partielle'].includes(bon.statut) && canCreate && (
            <button className="btn-ghost" onClick={() => navigate(`/modules/achats/receptions?bon_id=${id}`)}>
              <PackageCheck size={16} /> Réceptionner
            </button>
          )}
          {bon.statut !== 'annule' && bon.solde > 0 && canCreate && (
            <button className="btn-accent" onClick={() => navigate(`/modules/achats/paiements?bon_id=${id}`)}>
              <Wallet size={16} /> Enregistrer un paiement
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
                <th className="py-2">Commandé</th>
                <th className="py-2">Reçu</th>
                <th className="py-2">Prix unitaire</th>
                <th className="py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bon.lignes.map((l) => (
                <tr key={l.id}>
                  <td className="py-2">{l.designation}</td>
                  <td className="py-2">{l.quantite} {l.unite}</td>
                  <td className="py-2">
                    <span className={Number(l.quantite_recue) >= Number(l.quantite) ? 'text-emerald-600' : 'text-hq-orange-dark'}>
                      {l.quantite_recue} {l.unite}
                    </span>
                  </td>
                  <td className="py-2">{Number(l.prix_unitaire).toLocaleString('fr-FR')}</td>
                  <td className="py-2 text-right">{Number(l.montant).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-right text-sm font-semibold text-slate-700">
            Total : {Number(bon.montant_total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {bon.devise}
          </p>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Paiements</h2>
          <div className="mb-3 space-y-1 text-sm">
            <p className="flex justify-between text-slate-500">
              <span>Payé</span>
              <span className="font-medium text-slate-700">{Number(bon.total_paye).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
            </p>
            <p className="flex justify-between text-slate-500">
              <span>Solde restant</span>
              <span className={`font-semibold ${bon.solde > 0 ? 'text-hq-orange-dark' : 'text-emerald-600'}`}>
                {Number(bon.solde).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
          {bon.paiements.length === 0 && <p className="text-sm text-slate-400">Aucun paiement enregistré.</p>}
          <ul className="space-y-2">
            {bon.paiements.map((p) => (
              <li key={p.id} className="flex justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <span className="text-slate-600">{new Date(p.date_paiement).toLocaleDateString('fr-FR')} · {PAIEMENT_MODE_LABEL[p.mode] || p.mode}</span>
                <span className="font-medium text-slate-800">{Number(p.montant).toLocaleString('fr-FR')}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

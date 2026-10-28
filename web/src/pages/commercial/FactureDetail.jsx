import DetailSkeleton from '../../components/DetailSkeleton.jsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, FileDown, Wallet } from 'lucide-react';
import { get, post, downloadFile } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { ENCAISSEMENT_MODE_LABEL, FACTURE_STATUS } from './statusMaps.js';

export default function FactureDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [facture, setFacture] = useState(null);
  const [error, setError] = useState('');

  const canDelete = can('commercial', 'delete');
  const canCreate = can('commercial', 'create');

  const load = useCallback(() => {
    get(`/commercial/factures/${id}`).then(setFacture).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const annuler = async () => {
    if (!window.confirm('Annuler cette facture ?')) return;
    try {
      await post(`/commercial/factures/${id}/annuler`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const telechargerPdf = async () => {
    try {
      await downloadFile(`/commercial/factures/${id}/pdf`, `${facture.numero}.pdf`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!facture) return error ? <p className="text-slate-500">{error}</p> : <DetailSkeleton />;

  return (
    <div>
      <button onClick={() => navigate('/modules/commercial/factures')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-hq-blue">
        <ArrowLeft size={16} /> Retour aux factures
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-hq-blue">{facture.numero}</h1>
            <StatusBadge status={facture.statut} map={FACTURE_STATUS} />
          </div>
          <p className="text-sm text-slate-500">{facture.client_nom}{facture.commande_numero ? ` · issue de ${facture.commande_numero}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={telechargerPdf}><FileDown size={16} /> Télécharger PDF</button>
          {facture.statut === 'emise' && canDelete && (
            <button className="btn-ghost" onClick={annuler}><Ban size={16} /> Annuler</button>
          )}
          {facture.statut !== 'annulee' && facture.solde > 0 && canCreate && (
            <button className="btn-accent" onClick={() => navigate(`/modules/commercial/encaissements?facture_id=${id}`)}>
              <Wallet size={16} /> Enregistrer un encaissement
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
              {facture.lignes.map((l) => (
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
            Total : {Number(facture.montant_total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
          </p>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Encaissements</h2>
          <div className="mb-3 space-y-1 text-sm">
            <p className="flex justify-between text-slate-500">
              <span>Encaissé</span>
              <span className="font-medium text-slate-700">{Number(facture.total_encaisse).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
            </p>
            <p className="flex justify-between text-slate-500">
              <span>Solde restant</span>
              <span className={`font-semibold ${facture.solde > 0 ? 'text-hq-orange-dark' : 'text-emerald-600'}`}>
                {Number(facture.solde).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
          {facture.encaissements.length === 0 && <p className="text-sm text-slate-400">Aucun encaissement enregistré.</p>}
          <ul className="space-y-2">
            {facture.encaissements.map((e) => (
              <li key={e.id} className="flex justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <span className="text-slate-600">
                  {new Date(e.date_encaissement).toLocaleDateString('fr-FR')} · {ENCAISSEMENT_MODE_LABEL[e.mode] || e.mode}
                </span>
                <span className="font-medium text-slate-800">{Number(e.montant).toLocaleString('fr-FR')}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

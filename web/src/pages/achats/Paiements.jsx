import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { PAIEMENT_MODE_LABEL } from './statusMaps.js';

export default function Paiements() {
  const { can } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bonsPayables, setBonsPayables] = useState([]);
  const [open, setOpen] = useState(false);
  const [bonId, setBonId] = useState('');
  const [bonDetail, setBonDetail] = useState(null);
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState('virement');
  const [reference, setReference] = useState('');

  const canCreate = can('achats', 'create');
  const bonIdFilter = searchParams.get('bon_id');

  const load = () => {
    const qs = bonIdFilter ? `?bon_id=${bonIdFilter}` : '';
    get(`/achats/paiements${qs}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [bonIdFilter]);

  useEffect(() => {
    get('/achats/bons-de-commande').then((all) => {
      setBonsPayables(all.filter((b) => b.statut !== 'annule' && b.statut !== 'brouillon'));
    }).catch(() => {});
  }, []);

  const selectBon = async (id) => {
    setBonId(id);
    setBonDetail(null);
    setMontant('');
    if (!id) return;
    const detail = await get(`/achats/bons-de-commande/${id}`).catch(() => null);
    setBonDetail(detail);
    if (detail) setMontant(String(detail.solde));
  };

  useEffect(() => {
    if (bonIdFilter) {
      selectBon(bonIdFilter);
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setBonId('');
    setBonDetail(null);
    setMontant('');
    setMode('virement');
    setReference('');
  };

  const submit = async () => {
    try {
      await post('/achats/paiements', { bon_id: bonId, montant: Number(montant), mode, reference });
      resetForm();
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'bon_numero', label: 'Bon de commande' },
    { key: 'date_paiement', label: 'Date', render: (r) => new Date(r.date_paiement).toLocaleDateString('fr-FR') },
    { key: 'montant', label: 'Montant', render: (r) => Number(r.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) },
    { key: 'mode', label: 'Mode', render: (r) => PAIEMENT_MODE_LABEL[r.mode] || r.mode },
    { key: 'enregistre_par_nom', label: 'Enregistré par', render: (r) => r.enregistre_par_nom || '—' },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} paiement(s){bonIdFilter ? ' pour ce bon' : ''}</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau paiement
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucun paiement enregistré." />

      <SlideOver open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouveau paiement">
        <div className="space-y-3">
          <div>
            <label className="label">Bon de commande</label>
            <select className="input" value={bonId} onChange={(e) => selectBon(e.target.value)}>
              <option value="">Sélectionner…</option>
              {bonsPayables.map((b) => (
                <option key={b.id} value={b.id}>{b.numero} — {b.fournisseur_nom}</option>
              ))}
            </select>
          </div>

          {bonDetail && (
            <>
              <p className="rounded-lg bg-hq-blue-light px-3 py-2 text-sm text-hq-blue">
                Solde restant dû : <strong>{Number(bonDetail.solde).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {bonDetail.devise}</strong>
              </p>
              <div>
                <label className="label">Montant</label>
                <input className="input" type="number" min="0" step="0.01" max={bonDetail.solde} value={montant} onChange={(e) => setMontant(e.target.value)} />
              </div>
              <div>
                <label className="label">Mode de paiement</label>
                <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
                  {Object.entries(PAIEMENT_MODE_LABEL).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Référence (n° transaction, chèque…)</label>
                <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <button className="btn-primary w-full" onClick={submit} disabled={!montant || Number(montant) <= 0}>
                Enregistrer le paiement
              </button>
            </>
          )}
        </div>
      </SlideOver>
    </div>
  );
}

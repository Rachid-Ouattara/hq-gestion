import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { ENCAISSEMENT_MODE_LABEL } from './statusMaps.js';

export default function Encaissements() {
  const { can } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [facturesPayables, setFacturesPayables] = useState([]);
  const [comptes, setComptes] = useState([]);
  const [open, setOpen] = useState(false);
  const [factureId, setFactureId] = useState('');
  const [factureDetail, setFactureDetail] = useState(null);
  const [compteId, setCompteId] = useState('');
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState('virement');
  const [reference, setReference] = useState('');

  const canCreate = can('commercial', 'create');
  const factureIdFilter = searchParams.get('facture_id');

  const load = () => {
    const qs = factureIdFilter ? `?facture_id=${factureIdFilter}` : '';
    get(`/commercial/encaissements${qs}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [factureIdFilter]);

  useEffect(() => {
    get('/commercial/factures').then((all) => {
      setFacturesPayables(all.filter((f) => ['emise', 'partiellement_payee'].includes(f.statut)));
    }).catch(() => {});
    get('/finance/comptes?is_active=true').then(setComptes).catch(() => {});
  }, []);

  const selectFacture = async (id) => {
    setFactureId(id);
    setFactureDetail(null);
    setMontant('');
    if (!id) return;
    const detail = await get(`/commercial/factures/${id}`).catch(() => null);
    setFactureDetail(detail);
    if (detail) setMontant(String(detail.solde));
  };

  useEffect(() => {
    if (factureIdFilter) {
      selectFacture(factureIdFilter);
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setFactureId('');
    setFactureDetail(null);
    setCompteId('');
    setMontant('');
    setMode('virement');
    setReference('');
  };

  const submit = async () => {
    try {
      await post('/commercial/encaissements', {
        facture_id: factureId,
        compte_id: compteId || null,
        montant: Number(montant),
        mode,
        reference,
      });
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
    { key: 'facture_numero', label: 'Facture' },
    { key: 'date_encaissement', label: 'Date', render: (r) => new Date(r.date_encaissement).toLocaleDateString('fr-FR') },
    { key: 'montant', label: 'Montant', render: (r) => Number(r.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) },
    { key: 'mode', label: 'Mode', render: (r) => ENCAISSEMENT_MODE_LABEL[r.mode] || r.mode },
    { key: 'enregistre_par_nom', label: 'Enregistré par', render: (r) => r.enregistre_par_nom || '—' },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} encaissement(s){factureIdFilter ? ' pour cette facture' : ''}</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvel encaissement
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucun encaissement enregistré." />

      <SlideOver open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouvel encaissement">
        <div className="space-y-3">
          <div>
            <label className="label">Facture</label>
            <select className="input" value={factureId} onChange={(e) => selectFacture(e.target.value)}>
              <option value="">Sélectionner…</option>
              {facturesPayables.map((f) => (
                <option key={f.id} value={f.id}>{f.numero} — {f.client_nom}</option>
              ))}
            </select>
          </div>

          {factureDetail && (
            <>
              <p className="rounded-lg bg-hq-blue-light px-3 py-2 text-sm text-hq-blue">
                Solde restant dû : <strong>{Number(factureDetail.solde).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</strong>
              </p>
              <div>
                <label className="label">Montant</label>
                <input className="input" type="number" min="0" step="0.01" max={factureDetail.solde} value={montant} onChange={(e) => setMontant(e.target.value)} />
              </div>
              <div>
                <label className="label">Mode de paiement</label>
                <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
                  {Object.entries(ENCAISSEMENT_MODE_LABEL).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Compte Finance (optionnel)</label>
                <select className="input" value={compteId} onChange={(e) => setCompteId(e.target.value)}>
                  <option value="">— Ne pas relier à un compte —</option>
                  {comptes.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.libelle}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Référence (n° transaction, chèque…)</label>
                <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <button className="btn-primary w-full" onClick={submit} disabled={!montant || Number(montant) <= 0}>
                Enregistrer l'encaissement
              </button>
            </>
          )}
        </div>
      </SlideOver>
    </div>
  );
}

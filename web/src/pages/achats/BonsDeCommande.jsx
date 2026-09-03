import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import LineItemsEditor from '../../components/LineItemsEditor.jsx';
import { BON_STATUS } from './statusMaps.js';

const EMPTY_LINE = { designation: '', quantite: '1', unite: '', prix_unitaire: '0' };

export default function BonsDeCommande() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [demandesValidees, setDemandesValidees] = useState([]);
  const [open, setOpen] = useState(false);
  const [demandeId, setDemandeId] = useState('');
  const [fournisseurId, setFournisseurId] = useState('');
  const [conditions, setConditions] = useState('');
  const [lignes, setLignes] = useState([{ ...EMPTY_LINE }]);

  const canCreate = can('achats', 'create');

  const load = () => get('/achats/bons-de-commande').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));

  useEffect(() => {
    load();
    get('/achats/fournisseurs?is_active=true').then(setFournisseurs).catch(() => {});
    get('/achats/demandes?statut=validee').then(setDemandesValidees).catch(() => {});
  }, []);

  const prefillFromDemande = useCallback(async (id) => {
    if (!id) return;
    const d = await get(`/achats/demandes/${id}`).catch(() => null);
    if (!d) return;
    if (d.fournisseur_suggere_id) setFournisseurId(d.fournisseur_suggere_id);
    setLignes(d.lignes.map((l) => ({
      designation: l.designation,
      quantite: String(l.quantite),
      unite: l.unite || '',
      prix_unitaire: String(l.prix_estime_unitaire),
    })));
  }, []);

  useEffect(() => {
    const fromQuery = searchParams.get('demande_id');
    if (fromQuery) {
      setDemandeId(fromQuery);
      prefillFromDemande(fromQuery);
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setDemandeId('');
    setFournisseurId('');
    setConditions('');
    setLignes([{ ...EMPTY_LINE }]);
  };

  const submit = async () => {
    try {
      await post('/achats/bons-de-commande', {
        demande_id: demandeId || null,
        fournisseur_id: fournisseurId,
        conditions_livraison: conditions,
        lignes: lignes.map((l) => ({ ...l, quantite: Number(l.quantite), prix_unitaire: Number(l.prix_unitaire) })),
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
    { key: 'fournisseur_nom', label: 'Fournisseur' },
    { key: 'date_commande', label: 'Date', render: (r) => new Date(r.date_commande).toLocaleDateString('fr-FR') },
    {
      key: 'montant_total',
      label: 'Montant',
      render: (r) => `${Number(r.montant_total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${r.devise}`,
    },
    { key: 'statut', label: 'Statut', render: (r) => <StatusBadge status={r.statut} map={BON_STATUS} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} bon(s) de commande</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau bon de commande
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucun bon de commande." />

      <SlideOver open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouveau bon de commande" widthClass="max-w-2xl">
        <div className="space-y-3">
          <div>
            <label className="label">Depuis une demande validée (optionnel)</label>
            <select
              className="input"
              value={demandeId}
              onChange={(e) => { setDemandeId(e.target.value); prefillFromDemande(e.target.value); }}
            >
              <option value="">— Bon de commande autonome —</option>
              {demandesValidees.map((d) => (
                <option key={d.id} value={d.id}>{d.numero} — {d.objet}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fournisseur</label>
            <select className="input" value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)}>
              <option value="">Sélectionner…</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Conditions de livraison</label>
            <input className="input" value={conditions} onChange={(e) => setConditions(e.target.value)} />
          </div>
          <div>
            <label className="label">Articles / services commandés</label>
            <LineItemsEditor lines={lignes} onChange={setLignes} priceLabel="Prix unitaire" priceKey="prix_unitaire" />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!fournisseurId}>Enregistrer en brouillon</button>
        </div>
      </SlideOver>
    </div>
  );
}

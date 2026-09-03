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
import { COMMANDE_STATUS } from './statusMaps.js';

const EMPTY_LINE = { designation: '', quantite: '1', unite: '', prix_unitaire: '0' };

export default function Commandes() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [devisId, setDevisId] = useState('');
  const [clientId, setClientId] = useState('');
  const [conditions, setConditions] = useState('');
  const [lignes, setLignes] = useState([{ ...EMPTY_LINE }]);

  const canCreate = can('commercial', 'create');

  const load = () => get('/commercial/commandes').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => { get('/commercial/clients?is_active=true').then(setClients).catch(() => {}); }, []);

  const prefillFromDevis = useCallback(async (id) => {
    if (!id) return;
    const d = await get(`/commercial/devis/${id}`).catch(() => null);
    if (!d) return;
    setClientId(d.client_id);
    setLignes(d.lignes.map((l) => ({
      designation: l.designation,
      quantite: String(l.quantite),
      unite: l.unite || '',
      prix_unitaire: String(l.prix_unitaire),
    })));
  }, []);

  useEffect(() => {
    const fromQuery = searchParams.get('devis_id');
    if (fromQuery) {
      setDevisId(fromQuery);
      prefillFromDevis(fromQuery);
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setDevisId('');
    setClientId('');
    setConditions('');
    setLignes([{ ...EMPTY_LINE }]);
  };

  const submit = async () => {
    try {
      await post('/commercial/commandes', {
        devis_id: devisId || null,
        client_id: clientId,
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
    { key: 'client_nom', label: 'Client' },
    { key: 'date_commande', label: 'Date', render: (r) => new Date(r.date_commande).toLocaleDateString('fr-FR') },
    {
      key: 'montant_total',
      label: 'Montant',
      render: (r) => `${Number(r.montant_total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${r.devise}`,
    },
    { key: 'statut', label: 'Statut', render: (r) => <StatusBadge status={r.statut} map={COMMANDE_STATUS} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} commande(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle commande
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucune commande." />

      <SlideOver open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouvelle commande" widthClass="max-w-2xl">
        <div className="space-y-3">
          <div>
            <label className="label">Client</label>
            <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Sélectionner…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
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
          <button className="btn-primary w-full" onClick={submit} disabled={!clientId}>Enregistrer en brouillon</button>
        </div>
      </SlideOver>
    </div>
  );
}

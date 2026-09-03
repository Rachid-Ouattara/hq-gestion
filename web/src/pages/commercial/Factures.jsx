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
import { FACTURE_STATUS } from './statusMaps.js';

const EMPTY_LINE = { designation: '', quantite: '1', unite: '', prix_unitaire: '0' };

export default function Factures() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [commandeId, setCommandeId] = useState('');
  const [clientId, setClientId] = useState('');
  const [echeance, setEcheance] = useState('');
  const [lignes, setLignes] = useState([{ ...EMPTY_LINE }]);

  const canCreate = can('commercial', 'create');

  const load = () => get('/commercial/factures').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => { get('/commercial/clients?is_active=true').then(setClients).catch(() => {}); }, []);

  const prefillFromCommande = useCallback(async (id) => {
    if (!id) return;
    const c = await get(`/commercial/commandes/${id}`).catch(() => null);
    if (!c) return;
    setClientId(c.client_id);
    setLignes(c.lignes.map((l) => ({
      designation: l.designation,
      quantite: String(l.quantite),
      unite: l.unite || '',
      prix_unitaire: String(l.prix_unitaire),
    })));
  }, []);

  useEffect(() => {
    const fromQuery = searchParams.get('commande_id');
    if (fromQuery) {
      setCommandeId(fromQuery);
      prefillFromCommande(fromQuery);
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setCommandeId('');
    setClientId('');
    setEcheance('');
    setLignes([{ ...EMPTY_LINE }]);
  };

  const submit = async () => {
    try {
      await post('/commercial/factures', {
        commande_id: commandeId || null,
        client_id: clientId,
        echeance: echeance || null,
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
    { key: 'date_facture', label: 'Date', render: (r) => new Date(r.date_facture).toLocaleDateString('fr-FR') },
    {
      key: 'montant_total',
      label: 'Montant',
      render: (r) => Number(r.montant_total).toLocaleString('fr-FR', { minimumFractionDigits: 2 }),
    },
    { key: 'statut', label: 'Statut', render: (r) => <StatusBadge status={r.statut} map={FACTURE_STATUS} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} facture(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle facture
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucune facture." />

      <SlideOver open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouvelle facture" widthClass="max-w-2xl">
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
            <label className="label">Échéance</label>
            <input className="input" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
          </div>
          <div>
            <label className="label">Articles / services facturés</label>
            <LineItemsEditor lines={lignes} onChange={setLignes} priceLabel="Prix unitaire" priceKey="prix_unitaire" />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!clientId}>Émettre la facture</button>
        </div>
      </SlideOver>
    </div>
  );
}

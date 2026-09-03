import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import LineItemsEditor from '../../components/LineItemsEditor.jsx';
import { DEVIS_STATUS } from './statusMaps.js';

const EMPTY_LINE = { designation: '', quantite: '1', unite: '', prix_unitaire: '0' };

export default function Devis() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [statutFilter, setStatutFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [objet, setObjet] = useState('');
  const [clientId, setClientId] = useState('');
  const [validiteJours, setValiditeJours] = useState('30');
  const [lignes, setLignes] = useState([{ ...EMPTY_LINE }]);

  const canCreate = can('commercial', 'create');

  const load = () => {
    const qs = statutFilter ? `?statut=${statutFilter}` : '';
    get(`/commercial/devis${qs}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [statutFilter]);
  useEffect(() => { get('/commercial/clients?is_active=true').then(setClients).catch(() => {}); }, []);

  const resetForm = () => {
    setObjet('');
    setClientId('');
    setValiditeJours('30');
    setLignes([{ ...EMPTY_LINE }]);
  };

  const submit = async () => {
    try {
      await post('/commercial/devis', {
        objet,
        client_id: clientId,
        validite_jours: Number(validiteJours),
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
    { key: 'objet', label: 'Objet' },
    { key: 'client_nom', label: 'Client' },
    {
      key: 'montant_total',
      label: 'Montant',
      render: (r) => Number(r.montant_total).toLocaleString('fr-FR', { minimumFractionDigits: 2 }),
    },
    { key: 'statut', label: 'Statut', render: (r) => <StatusBadge status={r.statut} map={DEVIS_STATUS} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select className="input max-w-xs" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(DEVIS_STATUS).map(([code, s]) => (
            <option key={code} value={code}>{s.label}</option>
          ))}
        </select>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau devis
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucun devis." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouveau devis" widthClass="max-w-2xl">
        <div className="space-y-3">
          <div>
            <label className="label">Objet</label>
            <input className="input" value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Ex. Prestation traiteur" />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <label className="label">Validité (jours)</label>
              <input className="input" type="number" min="1" value={validiteJours} onChange={(e) => setValiditeJours(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Articles / services proposés</label>
            <LineItemsEditor lines={lignes} onChange={setLignes} priceLabel="Prix unitaire" priceKey="prix_unitaire" />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!objet.trim() || !clientId}>
            Enregistrer en brouillon
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

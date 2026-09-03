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
import { DEMANDE_STATUS } from './statusMaps.js';

const EMPTY_LINE = { designation: '', quantite: '1', unite: '', prix_estime_unitaire: '0' };

export default function DemandesAchat() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statutFilter, setStatutFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [objet, setObjet] = useState('');
  const [justification, setJustification] = useState('');
  const [lignes, setLignes] = useState([{ ...EMPTY_LINE }]);

  const canCreate = can('achats', 'create');

  const load = () => {
    const qs = statutFilter ? `?statut=${statutFilter}` : '';
    get(`/achats/demandes${qs}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [statutFilter]);

  const resetForm = () => {
    setObjet('');
    setJustification('');
    setLignes([{ ...EMPTY_LINE }]);
  };

  const submit = async () => {
    try {
      await post('/achats/demandes', {
        objet,
        justification,
        lignes: lignes.map((l) => ({ ...l, quantite: Number(l.quantite), prix_estime_unitaire: Number(l.prix_estime_unitaire) })),
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
    { key: 'demandeur_nom', label: 'Demandeur', render: (r) => r.demandeur_nom || '—' },
    {
      key: 'montant_estime',
      label: 'Montant estimé',
      render: (r) => Number(r.montant_estime).toLocaleString('fr-FR', { minimumFractionDigits: 2 }),
    },
    { key: 'statut', label: 'Statut', render: (r) => <StatusBadge status={r.statut} map={DEMANDE_STATUS} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select className="input max-w-xs" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(DEMANDE_STATUS).map(([code, s]) => (
            <option key={code} value={code}>{s.label}</option>
          ))}
        </select>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle demande
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows} loading={loading}
        onRowClick={(r) => navigate(`${r.id}`)}
        emptyLabel="Aucune demande d'achat."
      />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle demande d'achat" widthClass="max-w-2xl">
        <div className="space-y-3">
          <div>
            <label className="label">Objet</label>
            <input className="input" value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Ex. Fournitures de bureau" />
          </div>
          <div>
            <label className="label">Justification</label>
            <textarea className="input" rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} />
          </div>
          <div>
            <label className="label">Articles / services demandés</label>
            <LineItemsEditor lines={lignes} onChange={setLignes} priceLabel="Prix estimé" priceKey="prix_estime_unitaire" />
          </div>
          <button className="btn-primary w-full" onClick={submit}>Enregistrer en brouillon</button>
        </div>
      </SlideOver>
    </div>
  );
}

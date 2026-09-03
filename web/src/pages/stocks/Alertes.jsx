import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { get } from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatCard from '../../components/StatCard.jsx';

export default function Alertes() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    get('/stocks/articles?sous_seuil=true&is_active=true').then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: 'reference', label: 'Référence', render: (a) => a.reference || '—' },
    { key: 'designation', label: 'Désignation' },
    { key: 'categorie_nom', label: 'Catégorie', render: (a) => a.categorie_nom || '—' },
    {
      key: 'quantite_stock',
      label: 'Stock actuel',
      render: (a) => <span className="font-semibold text-hq-orange-dark">{Number(a.quantite_stock).toLocaleString('fr-FR')} {a.unite}</span>,
    },
    { key: 'seuil_alerte', label: 'Seuil', render: (a) => `${Number(a.seuil_alerte).toLocaleString('fr-FR')} ${a.unite}` },
  ];

  return (
    <div>
      <div className="mb-4 max-w-xs">
        <StatCard label="Articles sous le seuil" value={loading ? undefined : rows.length} Icon={AlertTriangle} accent={rows.length > 0} />
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onRowClick={() => navigate('/modules/stocks/entrees')}
        emptyLabel="Aucun article sous son seuil de réapprovisionnement."
      />
    </div>
  );
}

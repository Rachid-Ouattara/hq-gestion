import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';

export default function Rapports() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [campagnes, setCampagnes] = useState([]);
  const [campagneFilter, setCampagneFilter] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    const qs = campagneFilter ? `?campagne_id=${campagneFilter}` : '';
    get(`/prospection/rapports${qs}`).then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [campagneFilter]);
  useEffect(() => { get('/prospection/campagnes').then(setCampagnes).catch(() => {}); }, []);

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'ecole_nom', label: 'École' },
    { key: 'campagne_nom', label: 'Campagne' },
    { key: 'date_contact', label: 'Date', render: (r) => new Date(r.date_contact).toLocaleDateString('fr-FR') },
    { key: 'resume', label: 'Résumé' },
    { key: 'redige_par_nom', label: 'Rédigé par', render: (r) => r.redige_par_nom || '—' },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select className="input max-w-xs" value={campagneFilter} onChange={(e) => setCampagneFilter(e.target.value)}>
          <option value="">Toutes les campagnes</option>
          {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <p className="text-sm text-slate-500">{rows.length} rapport(s)</p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onRowClick={(r) => navigate(`/modules/prospection/ecoles-cibles/${r.ecole_cible_id}`)}
        emptyLabel="Aucun rapport de visite."
      />
    </div>
  );
}

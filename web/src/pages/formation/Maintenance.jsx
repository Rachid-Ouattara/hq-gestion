import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { VISITE_STATUT } from './statusMaps.js';

const EMPTY_FORM = { ecole_id: '', salle_id: '', technicien_id: '', notes: '' };

export default function Maintenance() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ecoles, setEcoles] = useState([]);
  const [salles, setSalles] = useState([]);
  const [techniciens, setTechniciens] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('formation', 'create');

  const load = () => get('/formation/maintenance/visites').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    get('/formation/ecoles').then(setEcoles).catch(() => {});
    get('/rh/employes?statut=actif').then(setTechniciens).catch(() => {});
  }, []);

  const onSelectEcole = async (ecoleId, salleId = '') => {
    setForm((f) => ({ ...f, ecole_id: ecoleId, salle_id: '' }));
    if (!ecoleId) { setSalles([]); return; }
    const detail = await get(`/formation/ecoles/${ecoleId}`).catch(() => null);
    setSalles(detail?.salles || []);
    if (salleId) setForm((f) => ({ ...f, salle_id: salleId }));
  };

  useEffect(() => {
    const ecoleId = searchParams.get('ecole_id');
    if (ecoleId) {
      onSelectEcole(ecoleId, searchParams.get('salle_id') || '');
      setOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('ecole_id');
      next.delete('salle_id');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    try {
      const created = await post('/formation/maintenance/visites', { ...form, salle_id: form.salle_id || null, technicien_id: form.technicien_id || null });
      setForm(EMPTY_FORM);
      setSalles([]);
      setOpen(false);
      navigate(`/modules/formation/maintenance/${created.id}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'ecole_nom', label: 'École' },
    { key: 'salle_nom', label: 'Salle', render: (v) => v.salle_nom || 'Toute la salle informatique' },
    { key: 'date_visite', label: 'Date', render: (v) => new Date(v.date_visite).toLocaleDateString('fr-FR') },
    { key: 'technicien_nom', label: 'Technicien', render: (v) => (v.technicien_nom ? `${v.technicien_nom} ${v.technicien_prenom}` : '—') },
    { key: 'statut', label: 'Statut', render: (v) => <StatusBadge status={v.statut} map={VISITE_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} visite(s) de maintenance</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle visite
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`/modules/formation/maintenance/${r.id}`)} emptyLabel="Aucune visite de maintenance." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle visite de maintenance">
        <div className="space-y-3">
          <div>
            <label className="label">École</label>
            <select className="input" value={form.ecole_id} onChange={(e) => onSelectEcole(e.target.value)}>
              <option value="">Sélectionner…</option>
              {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Salle (optionnel)</label>
            <select className="input" value={form.salle_id} onChange={(e) => setForm({ ...form, salle_id: e.target.value })} disabled={!form.ecole_id}>
              <option value="">Toute la salle informatique</option>
              {salles.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Technicien (optionnel)</label>
            <select className="input" value={form.technicien_id} onChange={(e) => setForm({ ...form, technicien_id: e.target.value })}>
              <option value="">Non assigné</option>
              {techniciens.map((t) => <option key={t.id} value={t.id}>{t.nom} {t.prenom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.ecole_id}>Créer et diagnostiquer</button>
        </div>
      </SlideOver>
    </div>
  );
}

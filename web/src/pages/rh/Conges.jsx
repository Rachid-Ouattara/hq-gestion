import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { CONGE_STATUT, TYPE_CONGE_LABEL } from './statusMaps.js';

const EMPTY_FORM = { employe_id: '', type_conge: 'annuel', date_debut: '', date_fin: '', nombre_jours: '1', motif: '' };

export default function Conges() {
  const { can, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employes, setEmployes] = useState([]);
  const [statutFilter, setStatutFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('rh', 'create');
  const isStaff = !['formateur', 'employe'].includes(user?.role);

  const load = () => {
    const qs = statutFilter ? `?statut=${statutFilter}` : '';
    get(`/rh/conges${qs}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [statutFilter]);
  useEffect(() => { if (isStaff) get('/rh/employes?statut=actif').then(setEmployes).catch(() => {}); }, [isStaff]);

  const submit = async () => {
    try {
      await post('/rh/conges', { ...form, nombre_jours: Number(form.nombre_jours) });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    ...(isStaff ? [{ key: 'employe_nom', label: 'Employé', render: (c) => `${c.employe_nom} ${c.employe_prenom}` }] : []),
    { key: 'type_conge', label: 'Type', render: (c) => TYPE_CONGE_LABEL[c.type_conge] || c.type_conge },
    { key: 'date_debut', label: 'Période', render: (c) => `${new Date(c.date_debut).toLocaleDateString('fr-FR')} → ${new Date(c.date_fin).toLocaleDateString('fr-FR')}` },
    { key: 'nombre_jours', label: 'Jours' },
    { key: 'statut', label: 'Statut', render: (c) => <StatusBadge status={c.statut} map={CONGE_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select className="input max-w-xs" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(CONGE_STATUT).map(([code, s]) => (
            <option key={code} value={code}>{s.label}</option>
          ))}
        </select>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle demande
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucune demande de congé." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle demande de congé">
        <div className="space-y-3">
          {isStaff && (
            <div>
              <label className="label">Employé</label>
              <select className="input" value={form.employe_id} onChange={(e) => setForm({ ...form, employe_id: e.target.value })}>
                <option value="">Sélectionner…</option>
                {employes.map((e) => (
                  <option key={e.id} value={e.id}>{e.nom} {e.prenom} — {e.matricule}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Type de congé</label>
            <select className="input" value={form.type_conge} onChange={(e) => setForm({ ...form, type_conge: e.target.value })}>
              {Object.entries(TYPE_CONGE_LABEL).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date de début</label>
              <input className="input" type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
            </div>
            <div>
              <label className="label">Date de fin</label>
              <input className="input" type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Nombre de jours</label>
            <input className="input" type="number" min="0.5" step="0.5" value={form.nombre_jours} onChange={(e) => setForm({ ...form, nombre_jours: e.target.value })} />
          </div>
          <div>
            <label className="label">Motif</label>
            <textarea className="input" rows={2} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} />
          </div>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={(isStaff && !form.employe_id) || !form.date_debut || !form.date_fin}
          >
            Enregistrer en brouillon
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

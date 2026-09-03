import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { EVALUATION_STATUT } from './statusMaps.js';

const EMPTY_FORM = { employe_id: '', periode: '', score: '', points_forts: '', axes_amelioration: '', commentaires: '' };

export default function Evaluations() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employes, setEmployes] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('rh', 'create');
  const canUpdate = can('rh', 'update');

  const load = () => get('/rh/evaluations').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => { get('/rh/employes?statut=actif').then(setEmployes).catch(() => {}); }, []);

  const submit = async () => {
    try {
      await post('/rh/evaluations', { ...form, score: form.score === '' ? null : Number(form.score) });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const finaliser = async (row) => {
    try {
      await post(`/rh/evaluations/${row.id}/finaliser`, {});
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'employe_nom', label: 'Employé', render: (ev) => `${ev.employe_nom} ${ev.employe_prenom}` },
    { key: 'periode', label: 'Période' },
    { key: 'score', label: 'Score /20', render: (ev) => (ev.score != null ? ev.score : '—') },
    { key: 'evaluateur_nom', label: 'Évaluateur', render: (ev) => ev.evaluateur_nom || '—' },
    { key: 'statut', label: 'Statut', render: (ev) => <StatusBadge status={ev.statut} map={EVALUATION_STATUT} /> },
    ...(canUpdate
      ? [{
          key: 'actions',
          label: '',
          render: (ev) => ev.statut === 'brouillon' && (
            <button className="text-xs text-hq-blue hover:underline" onClick={() => finaliser(ev)}>Finaliser</button>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} évaluation(s)</p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouvelle évaluation
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucune évaluation enregistrée." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Nouvelle évaluation">
        <div className="space-y-3">
          <div>
            <label className="label">Employé</label>
            <select className="input" value={form.employe_id} onChange={(e) => setForm({ ...form, employe_id: e.target.value })}>
              <option value="">Sélectionner…</option>
              {employes.map((e) => (
                <option key={e.id} value={e.id}>{e.nom} {e.prenom} — {e.matricule}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Période</label>
              <input className="input" placeholder="Ex. 2026-S2" value={form.periode} onChange={(e) => setForm({ ...form, periode: e.target.value })} />
            </div>
            <div>
              <label className="label">Score /20</label>
              <input className="input" type="number" min="0" max="20" step="0.5" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Points forts</label>
            <textarea className="input" rows={2} value={form.points_forts} onChange={(e) => setForm({ ...form, points_forts: e.target.value })} />
          </div>
          <div>
            <label className="label">Axes d'amélioration</label>
            <textarea className="input" rows={2} value={form.axes_amelioration} onChange={(e) => setForm({ ...form, axes_amelioration: e.target.value })} />
          </div>
          <div>
            <label className="label">Commentaires</label>
            <textarea className="input" rows={2} value={form.commentaires} onChange={(e) => setForm({ ...form, commentaires: e.target.value })} />
          </div>
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.employe_id || !form.periode.trim()}
          >
            Enregistrer en brouillon
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

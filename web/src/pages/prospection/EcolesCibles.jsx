import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, Upload } from 'lucide-react';
import { get, post, uploadFile } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import { ECOLE_CIBLE_STATUT } from './statusMaps.js';

const EMPTY_FORM = { campagne_id: '', groupe_id: '', nom: '', ville: '', contact_nom: '', contact_telephone: '', contact_email: '' };

export default function EcolesCibles() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [campagnes, setCampagnes] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [campagneFilter, setCampagneFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState('');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [importCampagneId, setImportCampagneId] = useState('');
  const [importGroupeId, setImportGroupeId] = useState('');
  const [importGroupes, setImportGroupes] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const canCreate = can('prospection', 'create');

  const load = () => {
    const params = new URLSearchParams();
    if (campagneFilter) params.set('campagne_id', campagneFilter);
    if (statutFilter) params.set('statut', statutFilter);
    get(`/prospection/ecoles-cibles?${params}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [campagneFilter, statutFilter]);
  useEffect(() => { get('/prospection/campagnes').then(setCampagnes).catch(() => {}); }, []);

  useEffect(() => {
    if (!form.campagne_id) { setGroupes([]); return; }
    get(`/prospection/groupes?campagne_id=${form.campagne_id}`).then(setGroupes).catch(() => {});
  }, [form.campagne_id]);

  useEffect(() => {
    if (!importCampagneId) { setImportGroupes([]); return; }
    get(`/prospection/groupes?campagne_id=${importCampagneId}`).then(setImportGroupes).catch(() => {});
  }, [importCampagneId]);

  const submit = async () => {
    try {
      await post('/prospection/ecoles-cibles', { ...form, groupe_id: form.groupe_id || null });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const submitImport = async () => {
    setImportResult(null);
    if (!importFile || !importCampagneId) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('fichier', importFile);
      fd.append('campagne_id', importCampagneId);
      if (importGroupeId) fd.append('groupe_id', importGroupeId);
      const result = await uploadFile('/prospection/ecoles-cibles/import', fd);
      setImportResult(result);
      setImportFile(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  };

  const columns = [
    { key: 'nom', label: 'École' },
    { key: 'ville', label: 'Ville', render: (r) => r.ville || '—' },
    { key: 'campagne_nom', label: 'Campagne' },
    { key: 'groupe_nom', label: 'Groupe', render: (r) => r.groupe_nom || '—' },
    { key: 'statut', label: 'Statut', render: (r) => <StatusBadge status={r.statut} map={ECOLE_CIBLE_STATUT} /> },
    {
      key: 'date_relance',
      label: 'Relance',
      render: (r) => {
        if (!r.date_relance) return '—';
        const overdue = new Date(r.date_relance) <= new Date(new Date().toDateString());
        const label = new Date(r.date_relance).toLocaleDateString('fr-FR');
        return overdue ? (
          <span className="flex items-center gap-1 font-medium text-red-600">
            <AlertTriangle size={13} /> {label}
          </span>
        ) : (
          <span className="text-slate-600">{label}</span>
        );
      },
    },
  ];

  return (
    <div>
      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Importer une liste Excel</h2>
        <p className="mb-3 text-xs text-slate-400">
          Colonnes attendues, dans l'ordre : Nom, Ville, Contact, Téléphone, E-mail — 1ère ligne = en-têtes (ignorée).
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <select className="input" value={importCampagneId} onChange={(e) => setImportCampagneId(e.target.value)}>
            <option value="">Campagne…</option>
            {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select className="input" value={importGroupeId} onChange={(e) => setImportGroupeId(e.target.value)} disabled={!importCampagneId}>
            <option value="">Groupe (optionnel)</option>
            {importGroupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
          </select>
          <input
            className="input"
            type="file"
            accept=".xlsx"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          />
          <button className="btn-accent" onClick={submitImport} disabled={!importFile || !importCampagneId || importing}>
            <Upload size={16} /> {importing ? 'Import…' : 'Importer'}
          </button>
        </div>
        {importResult && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Import terminé : {importResult.imported} école(s) importée(s), {importResult.skipped} ligne(s) ignorée(s).
          </p>
        )}
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <select className="input max-w-xs" value={campagneFilter} onChange={(e) => setCampagneFilter(e.target.value)}>
            <option value="">Toutes les campagnes</option>
            {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select className="input max-w-xs" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            {Object.entries(ECOLE_CIBLE_STATUT).map(([code, s]) => (
              <option key={code} value={code}>{s.label}</option>
            ))}
          </select>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Ajouter une école
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`${r.id}`)} emptyLabel="Aucune école ciblée." />

      <SlideOver open={open} onClose={() => setOpen(false)} title="Ajouter une école ciblée">
        <div className="space-y-3">
          <div>
            <label className="label">Campagne</label>
            <select className="input" value={form.campagne_id} onChange={(e) => setForm({ ...form, campagne_id: e.target.value, groupe_id: '' })}>
              <option value="">Sélectionner…</option>
              {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Groupe (optionnel)</label>
            <select className="input" value={form.groupe_id} onChange={(e) => setForm({ ...form, groupe_id: e.target.value })} disabled={!form.campagne_id}>
              <option value="">— Non assigné —</option>
              {groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nom de l'école</label>
            <input className="input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div>
            <label className="label">Ville</label>
            <input className="input" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact</label>
              <input className="input" value={form.contact_nom} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.contact_telephone} onChange={(e) => setForm({ ...form, contact_telephone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.campagne_id || !form.nom.trim()}>Enregistrer</button>
        </div>
      </SlideOver>
    </div>
  );
}

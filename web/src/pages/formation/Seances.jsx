import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, LayoutGrid, List, Plus, Settings2 } from 'lucide-react';
import { get, post, put } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import SeancesCalendar from './SeancesCalendar.jsx';
import ChargeFormateurs from './ChargeFormateurs.jsx';
import { DOMAINE_LABEL, SEANCE_STATUT } from './statusMaps.js';

const EMPTY_FORM = {
  date_seance: '', heure_debut: '', heure_fin: '', lieu_type: 'ecole',
  ecole_id: '', salle_id: '', camp_id: '', domaine: 'informatique',
  formateur_id: '', classe_id: '', groupe: '', effectif_prevu: '',
};

export default function Seances() {
  const { user, can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isStaff = user?.role !== 'formateur';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statutFilter, setStatutFilter] = useState('');
  const [view, setView] = useState('liste');

  // Données de référence (staff uniquement)
  const [ecoles, setEcoles] = useState([]);
  const [salles, setSalles] = useState([]);
  const [classes, setClasses] = useState([]);
  const [camps, setCamps] = useState([]);
  const [formateurs, setFormateurs] = useState([]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [domainesOpen, setDomainesOpen] = useState(false);
  const [employesActifs, setEmployesActifs] = useState([]);
  const [domainesEmployeId, setDomainesEmployeId] = useState('');
  const [domainesSelection, setDomainesSelection] = useState([]);

  const canCreate = can('formation', 'create');

  const load = () => {
    const qs = statutFilter ? `?statut=${statutFilter}` : '';
    get(`/formation/seances${qs}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [statutFilter]);

  useEffect(() => {
    if (!isStaff) return;
    get('/formation/ecoles').then(setEcoles).catch(() => {});
    get('/formation/camps').then(setCamps).catch(() => {});
    get('/formation/formateurs').then(setFormateurs).catch(() => {});
  }, [isStaff]);

  const onSelectEcole = async (ecoleId) => {
    setForm({ ...form, ecole_id: ecoleId, salle_id: '', classe_id: '' });
    if (!ecoleId) { setSalles([]); setClasses([]); return; }
    const detail = await get(`/formation/ecoles/${ecoleId}`).catch(() => null);
    setSalles(detail?.salles || []);
    setClasses(detail?.classes || []);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setSalles([]);
    setClasses([]);
  };

  const submit = async () => {
    try {
      await post('/formation/seances', {
        ...form,
        effectif_prevu: form.effectif_prevu === '' ? null : Number(form.effectif_prevu),
        ecole_id: form.lieu_type === 'ecole' ? form.ecole_id : null,
        salle_id: form.lieu_type === 'ecole' ? form.salle_id : null,
        camp_id: form.lieu_type === 'camp' ? form.camp_id : null,
      });
      resetForm();
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openDomaines = async () => {
    if (employesActifs.length === 0) {
      const all = await get('/rh/employes?statut=actif').catch(() => []);
      setEmployesActifs(all);
    }
    setDomainesOpen(true);
  };

  const onSelectEmployeDomaines = async (employeId) => {
    setDomainesEmployeId(employeId);
    setDomainesSelection([]);
    if (!employeId) return;
    const detail = await get(`/formation/formateurs/${employeId}`).catch(() => null);
    setDomainesSelection(detail?.domaines || []);
  };

  const toggleDomaine = (domaine) => {
    setDomainesSelection((cur) => (cur.includes(domaine) ? cur.filter((d) => d !== domaine) : [...cur, domaine]));
  };

  const saveDomaines = async () => {
    try {
      await put(`/formation/formateurs/${domainesEmployeId}/domaines`, { domaines: domainesSelection });
      setDomainesOpen(false);
      setDomainesEmployeId('');
      toast.success('Mis à jour');
      get('/formation/formateurs').then(setFormateurs).catch(() => {});
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'date_seance', label: 'Date', render: (s) => new Date(s.date_seance).toLocaleDateString('fr-FR') },
    { key: 'heure_debut', label: 'Horaire', render: (s) => `${s.heure_debut.slice(0, 5)} - ${s.heure_fin.slice(0, 5)}` },
    { key: 'lieu', label: 'Lieu', render: (s) => s.ecole_nom ? `${s.ecole_nom} · ${s.salle_nom}${s.classe_nom ? ` · ${s.classe_nom}` : ''}` : s.camp_nom },
    { key: 'domaine', label: 'Domaine', render: (s) => DOMAINE_LABEL[s.domaine] || s.domaine },
    ...(isStaff ? [{
      key: 'formateur_nom',
      label: 'Formateur',
      render: (s) => (
        <span className="inline-flex items-center gap-1.5">
          {s.formateur_nom} {s.formateur_prenom}
          {s.formateur_en_conge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600" title="Ce formateur est en congé validé sur la date de cette séance">
              <AlertTriangle size={12} /> En congé
            </span>
          )}
        </span>
      ),
    }] : []),
    { key: 'statut', label: 'Statut', render: (s) => <StatusBadge status={s.statut} map={SEANCE_STATUT} /> },
    {
      key: 'actions',
      label: '',
      render: (s) => !isStaff && s.statut === 'planifiee' && (
        <button
          className="text-xs text-hq-blue hover:underline"
          onClick={() => navigate(`/modules/formation/rapports?seance_id=${s.id}`)}
        >
          Rédiger un rapport
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select className="input max-w-xs" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            {Object.entries(SEANCE_STATUT).map(([code, s]) => (
              <option key={code} value={code}>{s.label}</option>
            ))}
          </select>
          <div className="flex rounded-lg border border-slate-300 p-0.5">
            <button
              onClick={() => setView('liste')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                view === 'liste' ? 'bg-hq-blue text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <List size={14} /> Liste
            </button>
            <button
              onClick={() => setView('calendrier')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                view === 'calendrier' ? 'bg-hq-blue text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <LayoutGrid size={14} /> Calendrier
            </button>
            {isStaff && (
              <button
                onClick={() => setView('charge')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                  view === 'charge' ? 'bg-hq-blue text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <BarChart3 size={14} /> Charge
              </button>
            )}
          </div>
        </div>
        {isStaff && (
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={openDomaines}>
              <Settings2 size={18} /> Spécialités des formateurs
            </button>
            {canCreate && (
              <button className="btn-primary" onClick={() => setOpen(true)}>
                <Plus size={18} /> Nouvelle séance
              </button>
            )}
          </div>
        )}
      </div>

      {view === 'liste' ? (
        <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="Aucune séance." />
      ) : view === 'calendrier' ? (
        <SeancesCalendar rows={rows} isStaff={isStaff} />
      ) : (
        <ChargeFormateurs rows={rows} />
      )}

      <SlideOver open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouvelle séance" widthClass="max-w-2xl">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.date_seance} onChange={(e) => setForm({ ...form, date_seance: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Début</label>
                <input className="input" type="time" value={form.heure_debut} onChange={(e) => setForm({ ...form, heure_debut: e.target.value })} />
              </div>
              <div>
                <label className="label">Fin</label>
                <input className="input" type="time" value={form.heure_fin} onChange={(e) => setForm({ ...form, heure_fin: e.target.value })} />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Lieu</label>
            <select className="input" value={form.lieu_type} onChange={(e) => setForm({ ...form, lieu_type: e.target.value })}>
              <option value="ecole">École partenaire</option>
              <option value="camp">Camp de vacances</option>
            </select>
          </div>

          {form.lieu_type === 'ecole' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">École</label>
                <select className="input" value={form.ecole_id} onChange={(e) => onSelectEcole(e.target.value)}>
                  <option value="">Sélectionner…</option>
                  {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Salle</label>
                <select className="input" value={form.salle_id} onChange={(e) => setForm({ ...form, salle_id: e.target.value })} disabled={!form.ecole_id}>
                  <option value="">Sélectionner…</option>
                  {salles.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="label">Camp</label>
              <select className="input" value={form.camp_id} onChange={(e) => setForm({ ...form, camp_id: e.target.value })}>
                <option value="">Sélectionner…</option>
                {camps.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Domaine</label>
              <select className="input" value={form.domaine} onChange={(e) => setForm({ ...form, domaine: e.target.value })}>
                {Object.entries(DOMAINE_LABEL).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Formateur</label>
              <select className="input" value={form.formateur_id} onChange={(e) => setForm({ ...form, formateur_id: e.target.value })}>
                <option value="">Sélectionner…</option>
                {formateurs.map((f) => <option key={f.id} value={f.id}>{f.nom} {f.prenom}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {form.lieu_type === 'ecole' ? (
              <div>
                <label className="label">Classe</label>
                <select className="input" value={form.classe_id} onChange={(e) => setForm({ ...form, classe_id: e.target.value })} disabled={!form.ecole_id}>
                  <option value="">— Non assignée —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="label">Groupe</label>
                <input className="input" value={form.groupe} onChange={(e) => setForm({ ...form, groupe: e.target.value })} placeholder="Ex. Terminale S" />
              </div>
            )}
            <div>
              <label className="label">Effectif prévu</label>
              <input className="input" type="number" min="0" value={form.effectif_prevu} onChange={(e) => setForm({ ...form, effectif_prevu: e.target.value })} />
            </div>
          </div>

          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={!form.date_seance || !form.heure_debut || !form.heure_fin || !form.formateur_id || (form.lieu_type === 'ecole' ? !form.salle_id : !form.camp_id)}
          >
            Planifier la séance
          </button>
        </div>
      </SlideOver>

      <SlideOver open={domainesOpen} onClose={() => setDomainesOpen(false)} title="Spécialités des formateurs">
        <div className="space-y-3">
          <div>
            <label className="label">Employé</label>
            <select className="input" value={domainesEmployeId} onChange={(e) => onSelectEmployeDomaines(e.target.value)}>
              <option value="">Sélectionner…</option>
              {employesActifs.map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom} — {e.matricule}</option>)}
            </select>
          </div>
          {domainesEmployeId && (
            <>
              <div className="space-y-2">
                {Object.entries(DOMAINE_LABEL).map(([code, label]) => (
                  <label key={code} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={domainesSelection.includes(code)} onChange={() => toggleDomaine(code)} />
                    {label}
                  </label>
                ))}
              </div>
              <button className="btn-primary w-full" onClick={saveDomaines}>Enregistrer</button>
            </>
          )}
        </div>
      </SlideOver>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SlideOver from '../../components/SlideOver.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import { RAPPORT_STATUT } from './statusMaps.js';

export default function RapportsCours() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const isStaff = user?.role !== 'formateur';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seancesDisponibles, setSeancesDisponibles] = useState([]);
  const [open, setOpen] = useState(false);
  const [seanceId, setSeanceId] = useState('');
  const [contenu, setContenu] = useState('');
  const [effectifReel, setEffectifReel] = useState('');
  const [difficultes, setDifficultes] = useState('');
  const [commentaires, setCommentaires] = useState({});
  const [chapitres, setChapitres] = useState([]);
  const [chapitreIds, setChapitreIds] = useState([]);

  const load = () => get('/formation/rapports-cours').then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (isStaff) return;
    get('/formation/seances?statut=planifiee').then(setSeancesDisponibles).catch(() => {});
  }, [isStaff]);

  useEffect(() => {
    const fromQuery = searchParams.get('seance_id');
    if (fromQuery) {
      setSeanceId(fromQuery);
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setSeanceId('');
    setContenu('');
    setEffectifReel('');
    setDifficultes('');
    setChapitres([]);
    setChapitreIds([]);
  };

  const onSelectSeance = (id) => {
    setSeanceId(id);
    setChapitreIds([]);
    const seance = seancesDisponibles.find((s) => s.id === id);
    if (!seance?.classe_id) { setChapitres([]); return; }
    get(`/formation/chapitres?classe_id=${seance.classe_id}&domaine=${seance.domaine}`).then(setChapitres).catch(() => setChapitres([]));
  };

  const toggleChapitre = (id) => {
    setChapitreIds((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
  };

  const submit = async () => {
    try {
      await post('/formation/rapports-cours', {
        seance_id: seanceId,
        contenu,
        effectif_reel: effectifReel === '' ? null : Number(effectifReel),
        difficultes,
        chapitre_ids: chapitreIds,
      });
      resetForm();
      setOpen(false);
      toast.success('Enregistré');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const marquerLu = async (row) => {
    try {
      await post(`/formation/rapports-cours/${row.id}/lire`, { commentaire_rh: commentaires[row.id] || null });
      toast.success('Mis à jour');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'numero', label: 'N°' },
    { key: 'date_seance', label: 'Séance', render: (r) => `${r.seance_numero} · ${new Date(r.date_seance).toLocaleDateString('fr-FR')}` },
    ...(isStaff ? [{ key: 'formateur_nom', label: 'Formateur', render: (r) => `${r.formateur_nom} ${r.formateur_prenom}` }] : []),
    { key: 'effectif_reel', label: 'Effectif', render: (r) => r.effectif_reel ?? '—' },
    { key: 'statut', label: 'Statut', render: (r) => <StatusBadge status={r.statut} map={RAPPORT_STATUT} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} rapport(s)</p>
        {!isStaff && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Nouveau rapport
          </button>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4">
              <Skeleton className="mb-2 h-4 w-48" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))
        ) : (
          <>
            {rows.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-slate-700">{r.numero}</span>
                    <span className="ml-2 text-sm text-slate-400">
                      {r.seance_numero} · {new Date(r.date_seance).toLocaleDateString('fr-FR')}
                      {isStaff ? ` · ${r.formateur_nom} ${r.formateur_prenom}` : ''}
                    </span>
                  </div>
                  <StatusBadge status={r.statut} map={RAPPORT_STATUT} />
                </div>
                <p className="text-sm text-slate-600">{r.contenu}</p>
                {r.difficultes && <p className="mt-1 text-sm text-hq-orange-dark">Difficultés : {r.difficultes}</p>}
                {r.effectif_reel != null && <p className="mt-1 text-xs text-slate-400">Effectif présent : {r.effectif_reel}</p>}

                {r.chapitres && r.chapitres.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.chapitres.map((c) => (
                      <span key={c.id} className="rounded-full bg-hq-blue-light px-2 py-0.5 text-xs text-hq-blue">
                        {c.ordre}. {c.titre}
                      </span>
                    ))}
                  </div>
                )}

                {r.commentaire_rh && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
                    <span className="font-medium">Commentaire RH :</span> {r.commentaire_rh}
                  </div>
                )}

                {isStaff && r.statut === 'soumis' && (
                  <div className="mt-3 flex gap-2">
                    <input
                      className="input"
                      placeholder="Commentaire (optionnel)"
                      value={commentaires[r.id] || ''}
                      onChange={(e) => setCommentaires({ ...commentaires, [r.id]: e.target.value })}
                    />
                    <button className="btn-primary shrink-0" onClick={() => marquerLu(r)}>Marquer comme lu</button>
                  </div>
                )}
              </div>
            ))}
            {rows.length === 0 && (
              <div className="card p-8 text-center text-sm text-slate-400">Aucun rapport de cours.</div>
            )}
          </>
        )}
      </div>

      {!isStaff && (
        <SlideOver open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouveau rapport de cours">
          <div className="space-y-3">
            <div>
              <label className="label">Séance</label>
              <select className="input" value={seanceId} onChange={(e) => onSelectSeance(e.target.value)}>
                <option value="">Sélectionner…</option>
                {seancesDisponibles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.numero} — {new Date(s.date_seance).toLocaleDateString('fr-FR')} ({s.ecole_nom || s.camp_nom})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Contenu dispensé</label>
              <textarea className="input" rows={4} value={contenu} onChange={(e) => setContenu(e.target.value)} />
            </div>
            {chapitres.length > 0 && (
              <div>
                <label className="label">Chapitres du canevas couverts</label>
                <div className="space-y-1.5 rounded-lg border border-slate-200 p-3">
                  {chapitres.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={chapitreIds.includes(c.id)} onChange={() => toggleChapitre(c.id)} />
                      {c.ordre}. {c.titre}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="label">Effectif présent</label>
              <input className="input" type="number" min="0" value={effectifReel} onChange={(e) => setEffectifReel(e.target.value)} />
            </div>
            <div>
              <label className="label">Difficultés rencontrées</label>
              <textarea className="input" rows={2} value={difficultes} onChange={(e) => setDifficultes(e.target.value)} />
            </div>
            <button className="btn-primary w-full" onClick={submit} disabled={!seanceId || !contenu.trim()}>
              Soumettre le rapport
            </button>
          </div>
        </SlideOver>
      )}
    </div>
  );
}

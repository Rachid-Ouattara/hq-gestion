import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Download, FileText, Loader2, Send, UploadCloud } from 'lucide-react';
import { get, uploadFile } from '../../lib/api.js';

const TYPE_CONTRAT_LABEL = { cdi: 'CDI', cdd: 'CDD', stage: 'Stage', consultant: 'Consultant' };

const EMPTY_FORM = { nom: '', prenom: '', email: '', telephone: '' };

function formatSize(bytes) {
  const n = Number(bytes);
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function PostulerPoste() {
  const { posteId } = useParams();
  const [poste, setPoste] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    get(`/public/recrutement/${posteId}`).then(setPoste).catch(() => setLoadError("Cette offre n'est plus disponible ou n'existe pas."));
    get(`/public/recrutement/${posteId}/documents`).then(setDocuments).catch(() => {});
  }, [posteId]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setSubmitError('');
    try {
      const formData = new FormData();
      formData.append('nom', form.nom);
      formData.append('prenom', form.prenom);
      formData.append('email', form.email);
      formData.append('telephone', form.telephone);
      files.forEach((f) => formData.append('documents', f));
      await uploadFile(`/public/recrutement/${posteId}/candidater`, formData);
      setDone(true);
    } catch (err) {
      setSubmitError(err.message || 'Envoi impossible, réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-hq-mist">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-6 py-4">
          <img src="/logo.jpg" alt="Headquarters" className="h-8 w-8 rounded object-cover" />
          <span className="font-display text-lg font-extrabold tracking-tight text-hq-blue">Headquarters</span>
          <span className="text-sm text-slate-400">— Rejoignez-nous</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {loadError && <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">{loadError}</p>}

        {!loadError && !poste && (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}

        {poste && !done && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-hq-orange">
                {poste.departement || 'Headquarters'} · {TYPE_CONTRAT_LABEL[poste.type_contrat]}
              </p>
              <h1 className="font-display text-2xl font-extrabold text-hq-blue">{poste.titre}</h1>
              {poste.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{poste.description}</p>}

              {documents.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Documents de l'offre</p>
                  <div className="space-y-1.5">
                    {documents.map((d) => (
                      <a
                        key={d.id}
                        href={`/api/public/recrutement/${posteId}/documents/${d.id}/download`}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-hq-blue-light/40"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <FileText size={16} className="shrink-0 text-slate-400" />
                          <span className="truncate">{d.nom_original}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                          {formatSize(d.taille_octets)} <Download size={13} />
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={submit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <h2 className="mb-4 font-display text-lg font-bold text-hq-blue">Postuler</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Nom</label>
                  <input required className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-hq-cyan focus:ring-2 focus:ring-hq-cyan/20"
                    value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Prénom</label>
                  <input required className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-hq-cyan focus:ring-2 focus:ring-hq-cyan/20"
                    value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">E-mail</label>
                  <input required type="email" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-hq-cyan focus:ring-2 focus:ring-hq-cyan/20"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Téléphone</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-hq-cyan focus:ring-2 focus:ring-hq-cyan/20"
                    value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
                </div>
              </div>

              {/* Champ honeypot : invisible pour un humain, souvent rempli par les robots. */}
              <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
                <label htmlFor="site_web">Site web</label>
                <input id="site_web" name="site_web" tabIndex={-1} autoComplete="off"
                  value={form.site_web || ''} onChange={(e) => setForm({ ...form, site_web: e.target.value })} />
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-slate-600">CV et documents (PDF, Word ou image — 5 max)</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 hover:border-hq-cyan hover:text-hq-cyan">
                  <UploadCloud size={18} />
                  {files.length > 0 ? `${files.length} fichier(s) sélectionné(s)` : 'Cliquez pour choisir vos fichiers'}
                  <input type="file" multiple accept=".pdf,.doc,.docx,image/png,image/jpeg" className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} />
                </label>
              </div>

              {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}

              <button type="submit" disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-hq-orange py-2.5 text-sm font-semibold text-white transition-colors hover:bg-hq-orange-dark disabled:opacity-50">
                <Send size={16} /> {busy ? 'Envoi…' : 'Envoyer ma candidature'}
              </button>
            </form>
          </>
        )}

        {done && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={40} />
            <h2 className="font-display text-lg font-bold text-hq-blue">Candidature envoyée</h2>
            <p className="mt-2 text-sm text-slate-500">Merci ! Votre candidature a bien été transmise à notre équipe RH. Nous reviendrons vers vous si votre profil correspond à cette offre.</p>
          </div>
        )}
      </main>
    </div>
  );
}

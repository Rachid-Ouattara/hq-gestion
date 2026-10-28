import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { get, patch } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';

const EMPTY_FORM = { nom_legal: '', adresse: '', telephone: '', email: '', numero_fiscal: '' };

export default function Parametres() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    get('/settings/entreprise')
      .then((p) => setForm({
        nom_legal: p.nom_legal || '',
        adresse: p.adresse || '',
        telephone: p.telephone || '',
        email: p.email || '',
        numero_fiscal: p.numero_fiscal || '',
      }))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await patch('/settings/entreprise', form);
      toast.success('Enregistré');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="max-w-xl">
      <header className="mb-6 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-hq-blue">
          <Building2 size={20} className="text-white" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-hq-blue">Paramètres entreprise</h1>
          <p className="text-sm text-slate-500">Coordonnées affichées en en-tête des documents PDF (factures, devis, bons de commande, bulletins de paie).</p>
        </div>
      </header>

      <div className="card space-y-3 p-5">
        <div>
          <label className="label">Nom légal</label>
          <input className="input" value={form.nom_legal} onChange={(e) => setForm({ ...form, nom_legal: e.target.value })} />
        </div>
        <div>
          <label className="label">Adresse</label>
          <input className="input" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Téléphone</label>
            <input className="input" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Numéro fiscal (IFU)</label>
          <input className="input" value={form.numero_fiscal} onChange={(e) => setForm({ ...form, numero_fiscal: e.target.value })} />
        </div>
        <button className="btn-primary" onClick={save} disabled={saving || !form.nom_legal.trim()}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

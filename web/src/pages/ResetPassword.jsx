import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { post } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import AuthShell from '../components/AuthShell.jsx';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  const submit = async () => {
    if (!token) return;
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setBusy(true);
    setError('');
    try {
      await post('/auth/reset-password', { token, password });
      toast.success('Mot de passe mis à jour');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'Lien invalide ou expiré.');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthShell eyebrow="Récupération" title="Lien invalide">
        <p className="text-sm text-slate-600">
          Ce lien de réinitialisation est incomplet ou a déjà été utilisé. Faites une nouvelle demande.
        </p>
        <Link
          to="/mot-de-passe-oublie"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-hq-orange py-2.5 text-sm font-semibold text-white hover:bg-hq-orange-dark"
        >
          Refaire une demande
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Récupération" title="Nouveau mot de passe" subtitle="Choisissez un mot de passe d'au moins 8 caractères.">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Nouveau mot de passe</label>
          <input
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-hq-cyan focus:ring-2 focus:ring-hq-cyan/20"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {tooShort && <p className="mt-1 text-xs text-hq-orange-dark">Au moins 8 caractères.</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Confirmer le mot de passe</label>
          <input
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-hq-cyan focus:ring-2 focus:ring-hq-cyan/20"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoComplete="new-password"
          />
          {mismatch && <p className="mt-1 text-xs text-red-600">Les mots de passe ne correspondent pas.</p>}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-hq-orange py-2.5 text-sm font-semibold text-white transition-colors hover:bg-hq-orange-dark disabled:opacity-50"
          onClick={submit}
          disabled={busy || !password || !confirm}
        >
          <KeyRound size={16} /> {busy ? 'Enregistrement…' : 'Réinitialiser mon mot de passe'}
        </button>
      </div>
    </AuthShell>
  );
}

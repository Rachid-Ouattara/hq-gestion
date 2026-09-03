import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck, Send } from 'lucide-react';
import { post } from '../lib/api.js';
import AuthShell from '../components/AuthShell.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue, réessayez.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthShell eyebrow="Vérifiez votre boîte mail" title="Lien envoyé">
        <div className="rounded-xl border border-hq-cyan/30 bg-hq-blue-light/60 p-4">
          <MailCheck className="mb-2 text-hq-cyan" size={22} />
          <p className="text-sm text-slate-700">
            Si un compte existe avec l'adresse <strong>{email}</strong>, un lien de réinitialisation vient de lui être
            envoyé. Il reste valable une heure.
          </p>
        </div>
        <Link to="/login" className="mt-5 flex items-center gap-1.5 text-sm font-medium text-hq-cyan hover:text-hq-blue">
          <ArrowLeft size={15} /> Retour à la connexion
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Récupération"
      title="Mot de passe oublié"
      subtitle="Indiquez votre adresse e-mail, nous vous enverrons un lien de réinitialisation."
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Adresse e-mail</label>
          <input
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-hq-cyan focus:ring-2 focus:ring-hq-cyan/20"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoComplete="username"
            placeholder="vous@headquaters.org"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-hq-orange py-2.5 text-sm font-semibold text-white transition-colors hover:bg-hq-orange-dark disabled:opacity-50"
          onClick={submit}
          disabled={busy || !email}
        >
          <Send size={16} /> {busy ? 'Envoi…' : 'Envoyer le lien'}
        </button>
        <Link to="/login" className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-hq-blue">
          <ArrowLeft size={15} /> Retour à la connexion
        </Link>
      </div>
    </AuthShell>
  );
}

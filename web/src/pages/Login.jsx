import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import AuthShell from '../components/AuthShell.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell eyebrow="Bon retour" title="Connexion" subtitle="Accédez à votre espace HQ Gestion.">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Adresse e-mail</label>
          <input
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-hq-cyan focus:ring-2 focus:ring-hq-cyan/20"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder="vous@headquaters.org"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-600">Mot de passe</label>
            <Link to="/mot-de-passe-oublie" className="text-xs font-medium text-hq-cyan hover:text-hq-blue">
              Mot de passe oublié ?
            </Link>
          </div>
          <input
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-hq-cyan focus:ring-2 focus:ring-hq-cyan/20"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoComplete="current-password"
          />
        </div>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-hq-orange py-2.5 text-sm font-semibold text-white transition-colors hover:bg-hq-orange-dark disabled:opacity-50"
          onClick={submit}
          disabled={busy || !email || !password}
        >
          <LogIn size={17} /> {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </div>
    </AuthShell>
  );
}

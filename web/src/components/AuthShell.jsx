import { ShieldCheck } from 'lucide-react';

const PARTNER_SCHOOLS = ['Maarif Burkina', 'Enko Education', 'Les Lauréats'];

export default function AuthShell({ eyebrow, title, subtitle, children }) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Panneau de marque — masqué sur mobile, remplacé par un bandeau compact */}
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-hq-blue px-12 py-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '38px 38px',
          }}
        />
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #16BFD6 0%, transparent 70%)' }}
        />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-lg">
            <img src="/logo.jpg" alt="Headquarters" className="h-8 w-8 rounded object-cover" />
            <span className="font-display text-lg font-extrabold tracking-tight text-hq-blue">HQ Gestion</span>
          </div>
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hq-cyan/30 bg-hq-cyan/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-hq-cyan">
            <ShieldCheck size={13} /> Connexion sécurisée
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight text-balance">
            L'outil qui pilote nos écoles, notre équipe et notre croissance.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Formation, ressources humaines et prospection : toute l'activité de Headquarters, réunie en un seul endroit.
          </p>
        </div>

        <div className="relative">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Écoles partenaires</p>
          <div className="flex flex-wrap gap-2">
            {PARTNER_SCHOOLS.map((s) => (
              <span key={s} className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
                {s}
              </span>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Bandeau compact mobile */}
        <div className="flex items-center gap-2 bg-hq-blue px-6 py-4 lg:hidden">
          <img src="/logo.jpg" alt="Headquarters" className="h-7 w-7 rounded object-cover" />
          <span className="font-display text-base font-extrabold text-white">HQ Gestion</span>
        </div>

        {/* Panneau formulaire */}
        <main className="flex flex-1 items-center justify-center bg-hq-blue-light/40 px-6 py-12 lg:bg-white">
          <div className="w-full max-w-sm">
            {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-hq-cyan">{eyebrow}</p>}
            {title && <h2 className="font-display text-2xl font-extrabold text-hq-blue">{title}</h2>}
            {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

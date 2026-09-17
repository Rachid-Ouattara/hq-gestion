import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { get } from '../lib/api.js';

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQ('');
      setGroups([]);
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setGroups([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      get(`/search?q=${encodeURIComponent(term)}`)
        .then(setGroups)
        .catch(() => setGroups([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [q]);

  const goTo = (url) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
      >
        <Search size={16} />
        <span className="flex-1 text-left">Rechercher…</span>
        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">⌘K</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 top-24 w-full max-w-lg -translate-x-1/2 rounded-xl bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un employé, un client, une école…"
                className="flex-1 border-0 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {loading && <p className="px-3 py-4 text-center text-sm text-slate-400">Recherche…</p>}
              {!loading && q.trim().length >= 2 && groups.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-slate-400">Aucun résultat.</p>
              )}
              {!loading && q.trim().length < 2 && (
                <p className="px-3 py-4 text-center text-sm text-slate-400">Tapez au moins 2 caractères.</p>
              )}
              {!loading && groups.map((g) => (
                <div key={g.key} className="mb-2">
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>
                  {g.items.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => goTo(item.url)}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-hq-blue-light/40"
                    >
                      <p className="font-medium text-slate-700">{item.label}</p>
                      {item.sublabel && <p className="text-xs text-slate-400">{item.sublabel}</p>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

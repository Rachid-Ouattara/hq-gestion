import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing } from 'lucide-react';
import { get, patch, post, tokens } from '../lib/api.js';
import { subscribeToPush } from '../lib/push.js';

const ROUTE_MAP = {
  'formation:rapport_cours': () => '/modules/rapports/cours',
  'formation:seance': () => '/modules/formation/seances',
  'rh:conge': (id) => `/modules/rh/conges/${id}`,
  'achats:demande_achat': (id) => `/modules/achats/demandes/${id}`,
  'stocks:article': () => '/modules/stocks/alertes',
  'rh:candidat': (id) => `/modules/rh/candidats/${id}`,
  'rh:pointage': () => '/modules/rh/presences',
  'rh:contrat': (id) => `/modules/rh/employes/${id}`,
  'rh:entretien': (id) => `/modules/rh/candidats/${id}`,
  'rh:employe': (id) => `/modules/rh/employes/${id}`,
  'administrative:courrier': (id) => `/modules/administrative/courrier/${id}`,
  'administrative:document': (id) => `/modules/administrative/documents/${id}`,
  'administrative:archive': (id) => `/modules/administrative/archives/${id}`,
  'administrative:note': (id) => `/modules/administrative/notes/${id}`,
  'administrative:agenda': () => '/modules/administrative/agenda',
  'finance:facture': (id) => `/modules/commercial/factures/${id}`,
  'finance:bon_commande': (id) => `/modules/achats/bons/${id}`,
};

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'));
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const panelRef = useRef(null);

  const load = () => get('/notifications').then(setNotifications).catch(() => {});

  const goToNotification = (n) => {
    const routeFn = ROUTE_MAP[`${n.module_code}:${n.entity_type}`];
    if (routeFn) {
      setOpen(false);
      navigate(routeFn(n.entity_id));
    }
  };

  useEffect(() => {
    load();

    const source = new EventSource(`/api/notifications/stream?token=${tokens.access}`);
    source.onmessage = (e) => {
      const notification = JSON.parse(e.data);
      setNotifications((prev) => [notification, ...prev]);
    };
    source.onerror = () => load();

    const onSwMessage = (e) => {
      if (e.data?.type === 'notification-click') {
        navigate(e.data.url);
      }
    };
    navigator.serviceWorker?.addEventListener?.('message', onSwMessage);

    return () => {
      source.close();
      navigator.serviceWorker?.removeEventListener?.('message', onSwMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.lu).length;

  const onClickNotification = async (n) => {
    if (!n.lu) {
      await patch(`/notifications/${n.id}/lire`, {}).catch(() => {});
      load();
    }
    goToNotification(n);
  };

  const markAllRead = async () => {
    await post('/notifications/lire-tout', {}).catch(() => {});
    load();
  };

  const enablePush = async () => {
    setPushBusy(true);
    setPushError('');
    try {
      await subscribeToPush();
      setPushPermission('granted');
    } catch (err) {
      setPushError(err.message);
      setPushPermission(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div ref={panelRef} className="relative px-3 pb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <span className="relative">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-hq-orange px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        Notifications
      </button>

      {open && (
        <div className="fixed inset-x-4 top-16 z-50 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl lg:inset-x-auto lg:left-[17rem] lg:w-80">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-hq-blue">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-hq-blue hover:underline">
                Tout marquer comme lu
              </button>
            )}
          </div>
          {pushPermission === 'default' && (
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-hq-blue-light/30 px-4 py-2.5">
              <p className="flex items-center gap-1.5 text-xs text-hq-blue">
                <BellRing size={14} /> Recevez les notifications même hors de l'application.
              </p>
              <button
                onClick={enablePush}
                disabled={pushBusy}
                className="shrink-0 rounded-full bg-hq-orange px-2.5 py-1 text-xs font-medium text-white hover:bg-hq-orange-dark disabled:opacity-50"
              >
                {pushBusy ? '…' : 'Activer'}
              </button>
            </div>
          )}
          {pushError && <p className="border-b border-slate-100 px-4 py-2 text-xs text-red-600">{pushError}</p>}
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => onClickNotification(n)}
                className={`block w-full border-b border-slate-50 px-4 py-3 text-left text-sm hover:bg-hq-blue-light/40 ${!n.lu ? 'bg-hq-blue-light/20' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`font-medium ${n.lu ? 'text-slate-600' : 'text-hq-blue'}`}>{n.titre}</p>
                  {!n.lu && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-hq-orange" />}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.created_at)}</p>
              </button>
            ))}
            {notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Aucune notification.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

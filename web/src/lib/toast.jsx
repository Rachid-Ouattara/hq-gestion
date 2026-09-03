import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  success: { className: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  error: { className: 'bg-red-50 text-red-600', Icon: XCircle },
  info: { className: 'bg-hq-blue-light text-hq-blue', Icon: Info },
};

function ToastViewport({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const { className, Icon } = STYLES[t.type] || STYLES.info;
        return (
          <div key={t.id} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm shadow-md ${className}`}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1">{t.message}</p>
            <button onClick={() => removeToast(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'info', message }) => {
    const id = crypto.randomUUID();
    const duration = type === 'error' ? 6000 : 3000;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  const value = useMemo(() => ({
    toasts,
    removeToast,
    success: (message) => addToast({ type: 'success', message }),
    error: (message) => addToast({ type: 'error', message }),
    info: (message) => addToast({ type: 'info', message }),
  }), [toasts, addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

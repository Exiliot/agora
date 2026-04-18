import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Toast, type ToastTone } from './Toast';

interface ToastEntry {
  id: number;
  tone: ToastTone;
  title?: string;
  body: string;
  /** Auto-dismiss after this many ms. 0 = sticky until user clicks. */
  ttlMs?: number;
}

interface ToastContextValue {
  push: (entry: Omit<ToastEntry, 'id'>) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Imperatively surface a toast from anywhere in the tree. */
export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used under <ToastHost>');
  return ctx;
};

interface ToastHostProps {
  children: ReactNode;
}

/**
 * Live region + stack for dismissable toasts. Mounts at the root of the
 * authenticated shell so WS reconnect, upload errors, moderation outcomes,
 * and anything else currently hitting window.alert / window.confirm can
 * surface in-app.
 */
export const ToastHost = ({ children }: ToastHostProps) => {
  const [entries, setEntries] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const push = useCallback<ToastContextValue['push']>(
    (entry) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const full: ToastEntry = { id, ttlMs: 4500, ...entry };
      setEntries((prev) => [...prev, full]);
      if (full.ttlMs && full.ttlMs > 0) {
        setTimeout(() => dismiss(id), full.ttlMs);
      }
      return id;
    },
    [dismiss],
  );

  const ctx = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 100,
          pointerEvents: 'none',
        }}
      >
        {entries.map((e) => (
          <div
            key={e.id}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={() => dismiss(e.id)}
            role={e.tone === 'error' || e.tone === 'warn' ? 'alert' : 'status'}
          >
            {e.title ? (
              <Toast tone={e.tone} title={e.title}>
                {e.body}
              </Toast>
            ) : (
              <Toast tone={e.tone}>{e.body}</Toast>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

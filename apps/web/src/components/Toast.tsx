import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';

export type ToastTone = 'info' | 'ok' | 'bad';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
  comingSoon: () => void;
}

const NOOP_TOAST: ToastContextValue = {
  toast: () => {},
  comingSoon: () => {},
};

const ToastContext = createContext<ToastContextValue>(NOOP_TOAST);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const timer of timers.current) {
        window.clearTimeout(timer);
      }
      timers.current = [];
    };
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3400);
    timers.current.push(timer);
  }, []);

  const comingSoon = useCallback(() => {
    toast('Sắp ra mắt');
  }, [toast]);

  const value = useMemo(() => ({ toast, comingSoon }), [toast, comingSoon]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div id="toasts" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={item.tone === 'info' ? 'toast' : `toast ${item.tone}`}
          >
            <Check size={16} className="ic" aria-hidden="true" />
            <span>{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

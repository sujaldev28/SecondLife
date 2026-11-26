'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  kind: ToastKind;
}

interface ToastContextValue {
  pushToast: (title: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({
  pushToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((title: string, kind: ToastKind = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, title, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto animate-sl-in flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-medium shadow-xl backdrop-blur"
            style={{
              backgroundColor: 'var(--surface-elevated)',
              borderColor:
                t.kind === 'success'
                  ? 'rgba(52, 211, 153, 0.45)'
                  : t.kind === 'error'
                    ? 'rgba(251, 113, 133, 0.45)'
                    : 'var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34D399]" />
            ) : t.kind === 'error' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#FB7185]" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-[#22D3EE]" />
            )}
            <span className="flex-1">{t.title}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-muted-token hover:text-primary-token"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

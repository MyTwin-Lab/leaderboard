'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  // Portal to document.body: a `fixed` container rendered inside a subtree
  // with any transform (e.g. an `animate-fade-up` tab panel) gets confined to
  // that ancestor's box instead of the viewport corner — this escapes it.
  useEffect(() => { setMounted(true); }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted && createPortal(
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />,
  error: <XCircle className="h-4 w-4 text-red-400 shrink-0" />,
  info: <AlertCircle className="h-4 w-4 text-brandCP shrink-0" />,
};

const borders: Record<ToastType, string> = {
  success: 'border-green-500/30',
  error: 'border-red-500/30',
  info: 'border-brandCP/30',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-lg border bg-background/95 backdrop-blur-sm px-4 py-3 shadow-xl text-sm text-white min-w-[280px] max-w-sm animate-slide-in ${borders[toast.type]}`}
    >
      {icons[toast.type]}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/40 hover:text-white/80 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}

'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { vitrineFontVars } from '@/components/vitrine/fonts';

import '@/components/vitrine/vitrine.css';
import '@/components/vitrine/forms-vitrine.css';

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

/**
 * Les toasts, sur le vocabulaire vitrine (`.v-toast*`). Portés vers
 * `document.body` sous leur propre racine `.vitrine-embed`, comme le tiroir.
 */
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
        <div className={`vitrine-embed ${vitrineFontVars}`}>
          <div className="v-toasts">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle />,
  error: <XCircle />,
  info: <AlertCircle />,
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  return (
    <div className="v-toast" data-tone={toast.type} role="status">
      {icons[toast.type]}
      <span className="v-toast-text">{toast.message}</span>
      <button type="button" onClick={() => onDismiss(toast.id)} className="v-btn-icon" aria-label="Dismiss">
        <X />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}

'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/vitrine/Modal';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/**
 * La confirmation générique, sur la modale vitrine : une carte centrée, une
 * pastille rouge pour une action destructive, deux boutons.
 */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const handleChoice = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  const danger = pending?.variant === 'danger';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        open={pending !== null}
        onClose={() => handleChoice(false)}
        title={pending?.title ?? ''}
        subtitle={pending?.message}
        icon={<AlertTriangle />}
        tone={danger ? 'danger' : 'accent'}
        size="sm"
        center
        above
        actions={
          <>
            <button type="button" className="v-btn-text" onClick={() => handleChoice(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={danger ? 'v-btn-danger' : 'v-btn'}
              onClick={() => handleChoice(true)}
              autoFocus
            >
              {pending?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmDialogProvider');
  return ctx.confirm;
}

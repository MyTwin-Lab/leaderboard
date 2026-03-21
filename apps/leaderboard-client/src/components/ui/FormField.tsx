import { ReactNode } from 'react';

export const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brandCP/50 focus:outline-none focus:ring-1 focus:ring-brandCP/50 disabled:opacity-40 transition-colors';

export const selectClass =
  'w-full rounded-lg border border-white/10 bg-[#0f0f1a] px-3 py-2 text-sm text-white focus:border-brandCP/50 focus:outline-none focus:ring-1 focus:ring-brandCP/50 disabled:opacity-40 transition-colors';

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, required, hint, children }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-white/60">
        {label}
        {required && <span className="ml-1 text-brandCP">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-white/30">{hint}</p>}
    </div>
  );
}

interface FormSectionProps {
  title: string;
  children: ReactNode;
}

export function FormSection({ title, children }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25">{title}</p>
      {children}
    </div>
  );
}

interface FormFooterProps {
  onCancel: () => void;
  submitLabel: string;
  loading?: boolean;
}

export function FormFooter({ onCancel, submitLabel, loading }: FormFooterProps) {
  return (
    <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:opacity-40"
        disabled={loading}
      >
        Cancel
      </button>
      <button
        type="submit"
        className="rounded-lg bg-brandCP px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-brandCP/80 disabled:opacity-40"
        disabled={loading}
      >
        {loading ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

import { ReactNode } from 'react';

export const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] disabled:opacity-40 transition-colors [color-scheme:dark]';

export const selectClass =
  'w-full rounded-xl border border-white/10 bg-[#0b0f14] px-4 py-2.5 text-sm text-white focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] disabled:opacity-40 transition-colors appearance-none cursor-pointer';

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, required, hint, children }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
        {label}
        {required && <span className="ml-1 text-brandCP">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-white/25">{hint}</p>}
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
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">{title}</p>
      <div className="space-y-4">{children}</div>
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
    <div className="flex justify-end gap-3 border-t border-white/[0.07] pt-5">
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="rounded-xl px-4 py-2 text-sm text-white/40 transition-colors hover:text-white/70 disabled:opacity-40"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-brandCP/20 px-5 py-2 text-sm font-semibold text-brandCP transition-all hover:bg-brandCP/30 hover:shadow-[0_0_16px_rgba(10,247,193,0.2)] disabled:opacity-40"
      >
        {loading ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

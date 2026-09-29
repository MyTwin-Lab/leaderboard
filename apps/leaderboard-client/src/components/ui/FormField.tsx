import { ReactNode } from 'react';

/**
 * Les briques des formulaires d'administration, sur le vocabulaire commun des
 * tiroirs et modales (`components/vitrine/forms-vitrine.css`). Un formulaire
 * qui les emploie se pose sous une racine `.vitrine-embed` — voir
 * `VitrineForm` — pour avoir les jetons `--v-*`.
 */

export const inputClass = 'v-input';

export const selectClass = 'v-select';

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, required, hint, children }: FormFieldProps) {
  return (
    <div className="v-field">
      <label className="v-label">
        {label}
        {required && <span className="v-label-required">*</span>}
      </label>
      {children}
      {hint && <p className="v-help" data-size="xs">{hint}</p>}
    </div>
  );
}

interface FormSectionProps {
  title: string;
  children: ReactNode;
}

export function FormSection({ title, children }: FormSectionProps) {
  return (
    <div className="v-section">
      <p className="v-section-title">{title}</p>
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
    <div className="v-form-foot">
      <button type="button" onClick={onCancel} disabled={loading} className="v-btn-text">
        Cancel
      </button>
      <button type="submit" disabled={loading} className="v-btn">
        {loading ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { integrationUrl, type IntegrationSummary } from '@/lib/integrations';
import { integrationErrorMessage } from '@/distribution/mytwin.integrations';

interface Props {
  integration: IntegrationSummary;
  /** Un code d'erreur revenu d'un OAuth (`no_org_admin`…). */
  initialError?: string | null;
  /** Après une connexion ou une déconnexion : l'état se relit côté serveur. */
  onChanged: () => void;
}

/**
 * La carte d'une intégration, d'après `Profile Vitrine.dc.html` : nom, état,
 * phrase, bouton — une seule forme pour tous les services.
 *
 * Tout ce qui la distingue (champs, libellés, détails, route) vient de sa
 * déclaration côté serveur (`IntegrationSummary`) : ses champs ou son bouton
 * OAuth tant qu'elle n'est pas connectée, ses détails et la déconnexion
 * ensuite.
 */
export function IntegrationCard({ integration, initialError, onChanged }: Props) {
  const { key, auth } = integration;
  const fields = auth.kind === 'api_key' ? auth.fields : [];

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(field => [field.name, field.defaultValue ?? ''])),
  );
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(initialError ? integrationErrorMessage(key, initialError) : null);

  const incomplete = fields.some(field => !values[field.name]?.trim());
  const connectedAt = integration.connected_at
    ? new Date(integration.connected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  async function handleSave() {
    if (incomplete) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(integrationUrl(key, 'connection'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(fields.map(field => [field.name, values[field.name]?.trim() ?? '']))),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to save credentials');
        return;
      }
      setValues(Object.fromEntries(fields.map(field => [field.name, field.defaultValue ?? ''])));
      onChanged();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch(integrationUrl(key, 'connection'), { method: 'DELETE' });
      if (res.ok) {
        setError(null);
        onChanged();
      }
    } finally {
      setDisconnecting(false);
    }
  }

  const details = [
    ...integration.details,
    ...(connectedAt ? [{ label: 'Connected', value: connectedAt }] : []),
  ];

  // Le contour au lieu du fond plein pour défaire : ce n'est pas l'action offerte.
  const action = integration.connected
    ? { label: disconnecting ? 'Disconnecting…' : 'Disconnect', onClick: handleDisconnect, busy: disconnecting, quiet: true }
    : auth.kind === 'oauth'
      ? {
          label: `Connect with ${integration.label}`,
          onClick: () => {
            window.location.href = integrationUrl(key, 'authorize');
          },
        }
      : { label: saving ? 'Verifying & saving…' : 'Save credentials', onClick: handleSave, busy: saving, disabled: incomplete };

  return (
    <div className="v-pro-int">
      <div className="v-pro-int-head">
        <span className="v-pro-int-name">{integration.label}</span>
        <span className="v-pro-int-state" data-on={integration.connected}>
          {integration.connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {error && (
        <p className="v-pro-alert">
          <AlertCircle />
          {error}
        </p>
      )}

      <span className="v-pro-int-desc">{integration.connected ? integration.connectionLabel : integration.description}</span>

      {integration.connected && details.length > 0 && (
        <dl className="v-pro-int-details">
          {details.map(detail => (
            <div key={detail.label} className="v-pro-int-row">
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {!integration.connected && fields.length > 0 && (
        <div className="v-pro-int-form">
          {fields.map((field, index) => (
            <input
              key={field.name}
              type={field.secret ? 'password' : 'text'}
              value={values[field.name] ?? ''}
              onChange={event => setValues(prev => ({ ...prev, [field.name]: event.target.value }))}
              onKeyDown={event => event.key === 'Enter' && index === fields.length - 1 && handleSave()}
              placeholder={field.placeholder ?? field.label}
              aria-label={field.label}
              autoComplete={field.secret ? 'new-password' : 'off'}
              className="v-pro-input"
            />
          ))}
        </div>
      )}

      <button
        onClick={action.onClick}
        disabled={action.busy || action.disabled}
        className="v-pro-int-btn"
        data-tone={action.quiet ? 'quiet' : undefined}
      >
        {action.busy && <Loader2 className="animate-spin" />}
        {action.label}
      </button>
    </div>
  );
}

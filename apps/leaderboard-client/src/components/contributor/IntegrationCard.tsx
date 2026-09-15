'use client';

import { useState } from 'react';
import { AlertCircle, Key, Loader2, Unlink } from 'lucide-react';
import { integrationUrl, type IntegrationSummary } from '@/lib/integrations';
import { integrationErrorMessage, integrationIcon } from '@/distribution/mytwin.integrations';

const INPUT_CLASS =
  'w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)] transition-all';

const ACTION_CLASS =
  'group w-full flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition-all hover:border-brandCP/40 hover:bg-brandCP/[0.06] focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed';

interface Props {
  integration: IntegrationSummary;
  /** Un code d'erreur revenu d'un OAuth (`no_org_admin`…). */
  initialError?: string | null;
  /** Après une connexion ou une déconnexion : l'état se relit côté serveur. */
  onChanged: () => void;
}

/**
 * La carte d'une intégration : ses champs ou son bouton OAuth tant qu'elle n'est
 * pas connectée, ses détails et la déconnexion ensuite. Tout ce qui la
 * distingue (champs, libellés, détails) vient de sa déclaration côté serveur.
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

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05]">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
          {integrationIcon(key)}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white/80">{integration.label}</p>
          <p className="text-[11px] text-white/30">{integration.connectionLabel}</p>
        </div>
        <div className="ml-auto flex-shrink-0">
          {integration.connected ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Connected
            </span>
          ) : (
            <span className="text-[11px] text-white/20">Not connected</span>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3 py-2.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-red-400" />
            <p className="text-[11px] leading-relaxed text-red-400">{error}</p>
          </div>
        )}

        {integration.connected ? (
          <>
            <div className="space-y-2">
              {integration.details.map(detail => (
                <div key={detail.label} className="flex items-center justify-between text-[12px]">
                  <span className="text-white/30">{detail.label}</span>
                  <span className="font-medium text-white/70">{detail.value}</span>
                </div>
              ))}
              {connectedAt && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-white/30">Connected</span>
                  <span className="text-white/40">{connectedAt}</span>
                </div>
              )}
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-2 text-[12px] text-white/25 hover:text-red-400 disabled:opacity-40 transition-colors"
            >
              {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </>
        ) : (
          <>
            <p className="text-[12px] leading-relaxed text-white/30">{integration.description}</p>

            {auth.kind === 'oauth' ? (
              <button onClick={() => { window.location.href = integrationUrl(key, 'authorize'); }} className={ACTION_CLASS}>
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.07] group-hover:border-brandCP/30 group-hover:bg-brandCP/10 transition-colors">
                  {integrationIcon(key)}
                </div>
                <span className="text-[13px] font-medium text-white/50 group-hover:text-white/80 transition-colors">
                  Connect with {integration.label}
                </span>
                <span className="ml-auto text-[11px] text-white/15 group-hover:text-brandCP/60 transition-colors">→</span>
              </button>
            ) : (
              <>
                <div className="space-y-2">
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
                      className={INPUT_CLASS}
                    />
                  ))}
                </div>
                <button onClick={handleSave} disabled={saving || incomplete} className={ACTION_CLASS}>
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.07] group-hover:border-brandCP/30 group-hover:bg-brandCP/10 transition-colors">
                    {saving
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brandCP/60" />
                      : <Key className="h-3.5 w-3.5 text-white/40 group-hover:text-brandCP/80 transition-colors" />}
                  </div>
                  <span className="text-[13px] font-medium text-white/50 group-hover:text-white/80 transition-colors">
                    {saving ? 'Verifying & saving…' : 'Save credentials'}
                  </span>
                  {!saving && <span className="ml-auto text-[11px] text-white/15 group-hover:text-brandCP/60 transition-colors">→</span>}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

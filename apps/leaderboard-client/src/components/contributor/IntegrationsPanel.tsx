'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IntegrationSummary } from '@/lib/integrations';
import { IntegrationCard } from './IntegrationCard';

/**
 * Les intégrations installées, une carte chacune. `errors` : les codes revenus
 * d'un OAuth, par clé d'intégration (`github` → `no_org_admin`…).
 */
export function IntegrationsPanel({ errors = {} }: { errors?: Record<string, string> }) {
  const [integrations, setIntegrations] = useState<IntegrationSummary[] | null>(null);

  const load = useCallback(() => {
    fetch('/api/integrations')
      .then(res => (res.ok ? res.json() : []))
      .then((data: IntegrationSummary[]) => setIntegrations(Array.isArray(data) ? data : []))
      .catch(() => setIntegrations([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
      {integrations === null
        ? [0, 1].map(i => <div key={i} className="h-32 rounded-xl border border-white/[0.07] bg-white/[0.02] animate-pulse" />)
        : integrations.map(integration => (
            <IntegrationCard
              key={integration.key}
              integration={integration}
              initialError={errors[integration.key] ?? null}
              onChanged={load}
            />
          ))}
    </div>
  );
}

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

  // Pas de grille ici : c'est la page qui pose `.v-pro-cards` autour, et les
  // cartes comme les squelettes s'y rangent directement.
  return (
    <>
      {integrations === null
        ? [0, 1, 2].map(i => <div key={i} className="v-pro-skeleton" aria-hidden />)
        : integrations.map(integration => (
            <IntegrationCard
              key={integration.key}
              integration={integration}
              initialError={errors[integration.key] ?? null}
              onChanged={load}
            />
          ))}
    </>
  );
}

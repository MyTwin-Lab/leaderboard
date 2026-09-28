import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import {
  IntegrationRegistry,
  integrationConnected,
  type IntegrationDefinition,
} from '../../../../../packages/connectors/integrations';
import { credentials } from '../../../../../packages/capabilities/credentials';
import { getSessionUser } from '@/lib/auth';
import type { IntegrationSummary } from '@/lib/integrations';

/**
 * Routes des intégrations — ce que partagent `/api/integrations/**` et la
 * route de compatibilité `/api/github-oauth/callback`.
 */

/** Le cookie d'état d'un OAuth en cours : `<clé>:<state>`. */
export const OAUTH_STATE_COOKIE = 'integration_oauth_state';

/** Où revient l'admin après une connexion OAuth. */
export const INTEGRATIONS_RETURN_PATH = '/contributors/me?tab=integrations';

/** L'appelant, s'il est admin. Rôle relu en base : une rétrogradation prend effet tout de suite. */
export async function adminSession() {
  const session = await getSessionUser();
  return session?.role === 'admin' ? session : null;
}

export function unknownIntegration(key: string) {
  return NextResponse.json({ error: `Unknown integration "${key}"` }, { status: 404 });
}

/** Ce que l'admin voit d'une intégration : ses champs, son état, ses détails. Jamais le secret. */
export async function integrationSummary(definition: IntegrationDefinition): Promise<IntegrationSummary> {
  const status = await credentials.status(definition.key);
  const connected = integrationConnected(definition, status);
  return {
    key: definition.key,
    label: definition.label,
    connectionLabel: definition.connectionLabel,
    description: definition.description,
    auth: definition.auth.kind === 'api_key'
      ? { kind: 'api_key', fields: definition.auth.fields.map(field => ({ ...field })) }
      : { kind: 'oauth' },
    connected,
    connected_at: connected ? status.connectedAt?.toISOString() ?? null : null,
    details: connected ? definition.publicMeta?.(status.meta) ?? [] : [],
  };
}

/**
 * Retour d'un OAuth : l'appelant doit être admin, l'état doit correspondre au
 * cookie posé par `authorize`, puis l'intégration échange le code. Le cookie est
 * effacé quelle que soit l'issue ; une erreur revient dans `<clé>_error`.
 */
export async function handleOAuthCallback(request: NextRequest, key: string): Promise<NextResponse> {
  const back = (error?: string) => {
    const path = error ? `${INTEGRATIONS_RETURN_PATH}&${key}_error=${encodeURIComponent(error)}` : INTEGRATIONS_RETURN_PATH;
    const response = NextResponse.redirect(new URL(path, request.url));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  };

  const definition = IntegrationRegistry.get(key);
  if (!definition || definition.auth.kind !== 'oauth') return back('unknown_integration');

  const session = await adminSession();
  if (!session) return back('not_admin');

  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');
  const stored = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!state || !stored || stored !== `${key}:${state}`) return back('csrf');

  let result;
  try {
    result = await definition.auth.callback({ code: searchParams.get('code') });
  } catch {
    return back('exchange_failed');
  }
  if (!result.ok) return back(result.error);

  try {
    await credentials.set(key, { secret: result.secret, meta: result.meta, connectedBy: session.id });
  } catch (error) {
    console.error(`[integrations/${key}/callback] Failed to save the connection:`, error);
    return back('save_failed');
  }
  return back();
}

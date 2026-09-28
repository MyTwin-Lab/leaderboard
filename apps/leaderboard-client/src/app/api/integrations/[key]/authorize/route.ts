import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { IntegrationRegistry } from '../../../../../../../../packages/connectors/integrations';
import { oauthStateCookieOptions } from '@/lib/sessionCookie';
import { adminSession, OAUTH_STATE_COOKIE, unknownIntegration } from '@/lib/server/integrations';

type Params = { params: Promise<{ key: string }> };

// GET /api/integrations/[key]/authorize — admin. Démarre l'OAuth d'une
// intégration : un état aléatoire en cookie, puis la page du fournisseur.
export async function GET(_request: Request, { params }: Params) {
  if (!(await adminSession())) return NextResponse.json({ error: 'Admin only' }, { status: 401 });

  const { key } = await params;
  const definition = IntegrationRegistry.get(key);
  if (!definition) return unknownIntegration(key);
  if (definition.auth.kind !== 'oauth') {
    return NextResponse.json({ error: 'This integration does not use OAuth' }, { status: 400 });
  }

  const state = randomBytes(16).toString('hex');
  const target = definition.auth.authorize({ state });
  if ('error' in target) return NextResponse.json({ error: target.error }, { status: 500 });

  const response = NextResponse.redirect(target.url);
  // httpOnly, lax, 600 s, et `secure` en prod (docs/temp.md, L2).
  response.cookies.set(OAUTH_STATE_COOKIE, `${key}:${state}`, oauthStateCookieOptions());
  return response;
}

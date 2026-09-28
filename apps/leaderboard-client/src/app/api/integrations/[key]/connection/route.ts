import { NextRequest, NextResponse } from 'next/server';
import { IntegrationRegistry } from '../../../../../../../../packages/connectors/integrations';
import { credentials } from '../../../../../../../../packages/capabilities/credentials';
import { adminSession, unknownIntegration } from '@/lib/server/integrations';

type Params = { params: Promise<{ key: string }> };

// POST /api/integrations/[key]/connection — admin. Enregistre une intégration à
// clé d'API, après vérification auprès du fournisseur. Corps : un champ par
// champ déclaré (`{ username, api_key }` pour Kaggle…).
export async function POST(request: NextRequest, { params }: Params) {
  const session = await adminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { key } = await params;
  const definition = IntegrationRegistry.get(key);
  if (!definition) return unknownIntegration(key);
  if (definition.auth.kind !== 'api_key') {
    return NextResponse.json({ error: 'This integration connects through OAuth' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const values: Record<string, string> = {};
  for (const field of definition.auth.fields) {
    const raw = body[field.name] ?? field.defaultValue ?? '';
    values[field.name] = typeof raw === 'string' ? raw.trim() : '';
  }
  const missing = definition.auth.fields.filter(field => !values[field.name]).map(field => field.name);
  if (missing.length > 0) {
    return NextResponse.json({ error: `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required` }, { status: 400 });
  }

  let result;
  try {
    result = await definition.auth.connect(values);
  } catch {
    return NextResponse.json({ error: `Could not reach ${definition.label}` }, { status: 502 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  try {
    await credentials.set(key, { secret: result.secret, meta: result.meta, connectedBy: session.id });
  } catch (error) {
    console.error(`Failed to save ${key} credentials:`, error);
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE /api/integrations/[key]/connection — admin. Déconnecte, selon la règle
// de l'intégration (suppression, ou déconnexion différée pour Scaleway).
export async function DELETE(_request: NextRequest, { params }: Params) {
  if (!(await adminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { key } = await params;
  const definition = IntegrationRegistry.get(key);
  if (!definition) return unknownIntegration(key);

  try {
    if (definition.disconnect) await definition.disconnect(credentials);
    else await credentials.remove(key);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Failed to disconnect ${key}:`, error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { IntegrationRegistry } from '../../../../../../../../packages/connectors/integrations';
import { getSessionUser } from '@/lib/auth';
import { integrationSummary, unknownIntegration } from '@/lib/server/integrations';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ key: string }> };

// GET /api/integrations/[key]/status — `connected` pour tout compte connecté,
// le seul champ que lisent les écrans non admin ; la date et les détails de la
// connexion pour l'admin.
export async function GET(_request: Request, { params }: Params) {
  const { key } = await params;
  const definition = IntegrationRegistry.get(key);
  if (!definition) return unknownIntegration(key);

  const session = await getSessionUser();
  const isAdmin = session?.role === 'admin';
  try {
    const summary = await integrationSummary(definition);
    if (!isAdmin) return NextResponse.json({ connected: summary.connected });
    return NextResponse.json({
      connected: summary.connected,
      connected_at: summary.connected_at,
      details: summary.details,
    });
  } catch {
    return NextResponse.json(isAdmin ? { connected: false, connected_at: null, details: [] } : { connected: false });
  }
}

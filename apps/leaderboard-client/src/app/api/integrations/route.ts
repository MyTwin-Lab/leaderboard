import { NextResponse } from 'next/server';
import { IntegrationRegistry } from '../../../../../../packages/connectors/integrations';
import { adminSession, integrationSummary } from '@/lib/server/integrations';

export const dynamic = 'force-dynamic';

// GET /api/integrations — admin. Les intégrations installées, avec leurs champs,
// leur état et ce qu'un admin voit d'une connexion établie.
export async function GET() {
  if (!(await adminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await Promise.all(IntegrationRegistry.list().map(integrationSummary)));
  } catch (error) {
    console.error('Error listing integrations:', error);
    return NextResponse.json({ error: 'Failed to list integrations' }, { status: 500 });
  }
}

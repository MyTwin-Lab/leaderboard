import { NextResponse } from 'next/server';
import { IntegrationRegistry } from '../../../../../../../../../packages/connectors/integrations';
import { ProjectRepository } from '../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { unknownIntegration } from '@/lib/server/integrations';

export const dynamic = 'force-dynamic';

const projectRepo = new ProjectRepository();

type Params = { params: Promise<{ key: string; action: string }> };

// GET /api/integrations/[key]/extras/[action] — une lecture annexe déclarée par
// l'intégration (les canaux Slack…), avec l'accès qu'elle déclare.
export async function GET(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { key, action } = await params;
  const definition = IntegrationRegistry.get(key);
  if (!definition) return unknownIntegration(key);
  const extra = definition.extras?.find(candidate => candidate.key === action);
  if (!extra) return NextResponse.json({ error: 'Unknown action' }, { status: 404 });

  if (user.role !== 'admin') {
    const allowed = extra.access === 'admin_or_manager'
      && (await projectRepo.findAll()).some(project => project.manager_id === user.id);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await extra.run();
    return result instanceof Response ? result : NextResponse.json(result ?? null);
  } catch (error) {
    console.error(`Error running ${key} extra "${action}":`, error);
    return NextResponse.json({ error: 'Failed to run integration action' }, { status: 500 });
  }
}

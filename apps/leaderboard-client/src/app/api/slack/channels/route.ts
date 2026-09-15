import { NextResponse } from 'next/server';
import { ConnectorRegistry } from '../../../../../../../packages/connectors/registry.js';
import type { ExternalConnector } from '../../../../../../../packages/connectors/interfaces.js';
import { ProjectRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import { getSessionUser } from '@/lib/auth';

const projectRepo = new ProjectRepository();

/** Un connecteur de discussion capable de lister ses canaux. */
type ChannelListingConnector = ExternalConnector & {
  listChannels(): Promise<{ id: string; name: string }[]>;
};

function canListChannels(connector: ExternalConnector | null): connector is ChannelListingConnector {
  return !!connector && typeof (connector as Partial<ChannelListingConnector>).listChannels === 'function';
}

// GET /api/slack/channels — liste des canaux publics accessibles au bot
// Réservé aux admins et aux managers de projet (config des challenges).
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    const projects = await projectRepo.findAll();
    const isManager = projects.some((p) => p.manager_id === user.id);
    if (!isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Sans canal désigné, le connecteur Slack sert à lister ceux du bot. Il
  // n'est pas construit tant que Slack n'est pas connecté.
  const connector = await ConnectorRegistry.createConnector({ type: 'slack' });
  if (!canListChannels(connector)) {
    return NextResponse.json({ error: 'Slack is not connected' }, { status: 400 });
  }

  try {
    const channels = await connector.listChannels();
    return NextResponse.json(channels);
  } catch (err) {
    console.error('Error listing Slack channels:', err);
    return NextResponse.json({ error: 'Failed to list Slack channels' }, { status: 502 });
  }
}

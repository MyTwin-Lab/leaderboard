import { NextResponse } from 'next/server';
import { getSlackToken } from '../../../../../../../packages/config/slackCredentials.js';
import { SlackConnector } from '../../../../../../../packages/connectors/implementation/Slack.connector.js';
import { ProjectRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import { getSessionUser } from '@/lib/auth';

const projectRepo = new ProjectRepository();

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

  const token = await getSlackToken();
  if (!token) {
    return NextResponse.json({ error: 'Slack is not connected' }, { status: 400 });
  }

  try {
    const connector = new SlackConnector({ token });
    const channels = await connector.listChannels();
    return NextResponse.json(channels);
  } catch (err) {
    console.error('Error listing Slack channels:', err);
    return NextResponse.json({ error: 'Failed to list Slack channels' }, { status: 502 });
  }
}

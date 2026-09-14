import { NextRequest, NextResponse } from 'next/server';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import { verifyAdmin } from '@/lib/auth';

const appSettingsRepo = new AppSettingsRepository();

// GET /api/slack/status — `connected` pour tous, le seul champ que lisent les
// écrans non admin ; le nom de l'espace Slack et la date de connexion pour l'admin.
export async function GET(request: NextRequest) {
  const isAdmin = !!(await verifyAdmin(request));
  try {
    const settings = await appSettingsRepo.get();
    if (!isAdmin) return NextResponse.json({ connected: settings.slack_is_connected });
    return NextResponse.json({
      connected: settings.slack_is_connected,
      team_name: settings.slack_team_name ?? null,
      connected_at: settings.slack_connected_at ?? null,
    });
  } catch {
    return NextResponse.json(
      isAdmin ? { connected: false, team_name: null, connected_at: null } : { connected: false }
    );
  }
}

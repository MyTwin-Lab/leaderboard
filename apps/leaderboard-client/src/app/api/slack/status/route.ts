import { NextResponse } from 'next/server';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';

const appSettingsRepo = new AppSettingsRepository();

export async function GET() {
  try {
    const settings = await appSettingsRepo.get();
    return NextResponse.json({
      connected: settings.slack_is_connected,
      team_name: settings.slack_team_name ?? null,
      connected_at: settings.slack_connected_at ?? null,
    });
  } catch {
    return NextResponse.json({ connected: false, team_name: null, connected_at: null });
  }
}

import { NextResponse } from 'next/server';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';

const appSettingsRepo = new AppSettingsRepository();

export async function GET() {
  try {
    const settings = await appSettingsRepo.get();
    return NextResponse.json({
      connected: settings.scaleway_is_connected,
      project_id: settings.scaleway_project_id ?? null,
      connected_at: settings.scaleway_connected_at ?? null,
    });
  } catch {
    return NextResponse.json({ connected: false, project_id: null, connected_at: null });
  }
}

import { NextResponse } from 'next/server';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';

const appSettingsRepo = new AppSettingsRepository();

export async function GET() {
  try {
    const settings = await appSettingsRepo.get();
    return NextResponse.json({
      connected: settings.kaggle_is_connected,
      username: settings.kaggle_username ?? null,
      connected_at: settings.kaggle_connected_at ?? null,
    });
  } catch {
    return NextResponse.json({ connected: false, username: null, connected_at: null });
  }
}

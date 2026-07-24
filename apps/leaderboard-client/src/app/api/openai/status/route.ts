import { NextResponse } from 'next/server';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';

const appSettingsRepo = new AppSettingsRepository();

export async function GET() {
  try {
    const settings = await appSettingsRepo.get();
    return NextResponse.json({
      connected: settings.openai_is_connected,
      connected_at: settings.openai_connected_at ?? null,
    });
  } catch {
    return NextResponse.json({ connected: false, connected_at: null });
  }
}

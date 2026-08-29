import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';

const appSettingsRepo = new AppSettingsRepository();

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }
  const settings = await appSettingsRepo.get();
  return NextResponse.json({
    connected: settings.github_is_connected,
    org: settings.github_org ?? null,
    connected_at: settings.github_connected_at?.toISOString() ?? null,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';

const appSettingsRepo = new AppSettingsRepository();

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }
  await appSettingsRepo.clearGithubConnection();
  return NextResponse.json({ ok: true });
}

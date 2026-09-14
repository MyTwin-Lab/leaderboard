import { NextRequest, NextResponse } from 'next/server';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import { verifyAdmin } from '@/lib/auth';

const appSettingsRepo = new AppSettingsRepository();

// GET /api/openai/status — `connected` pour tous ; la date de connexion pour
// l'admin seulement.
export async function GET(request: NextRequest) {
  const isAdmin = !!(await verifyAdmin(request));
  try {
    const settings = await appSettingsRepo.get();
    if (!isAdmin) return NextResponse.json({ connected: settings.openai_is_connected });
    return NextResponse.json({
      connected: settings.openai_is_connected,
      connected_at: settings.openai_connected_at ?? null,
    });
  } catch {
    return NextResponse.json(isAdmin ? { connected: false, connected_at: null } : { connected: false });
  }
}

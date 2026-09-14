import { NextRequest, NextResponse } from 'next/server';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import { verifyAdmin } from '@/lib/auth';

const appSettingsRepo = new AppSettingsRepository();

// GET /api/kaggle/status — `connected` pour tous, le seul champ que lisent les
// écrans non admin ; le compte Kaggle et la date de connexion pour l'admin.
export async function GET(request: NextRequest) {
  const isAdmin = !!(await verifyAdmin(request));
  try {
    const settings = await appSettingsRepo.get();
    if (!isAdmin) return NextResponse.json({ connected: settings.kaggle_is_connected });
    return NextResponse.json({
      connected: settings.kaggle_is_connected,
      username: settings.kaggle_username ?? null,
      connected_at: settings.kaggle_connected_at ?? null,
    });
  } catch {
    return NextResponse.json(
      isAdmin ? { connected: false, username: null, connected_at: null } : { connected: false }
    );
  }
}

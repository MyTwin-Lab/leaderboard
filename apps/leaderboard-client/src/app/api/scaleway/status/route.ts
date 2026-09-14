import { NextRequest, NextResponse } from 'next/server';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import { verifyAdmin } from '@/lib/auth';

const appSettingsRepo = new AppSettingsRepository();

// GET /api/scaleway/status — `connected` pour tous, le seul champ que lisent
// les écrans non admin (demande de compute, vue manager) ; le projet Scaleway
// et la date de connexion pour l'admin.
export async function GET(request: NextRequest) {
  const isAdmin = !!(await verifyAdmin(request));
  try {
    const settings = await appSettingsRepo.get();
    if (!isAdmin) return NextResponse.json({ connected: settings.scaleway_is_connected });
    return NextResponse.json({
      connected: settings.scaleway_is_connected,
      project_id: settings.scaleway_project_id ?? null,
      connected_at: settings.scaleway_connected_at ?? null,
    });
  } catch {
    return NextResponse.json(
      isAdmin ? { connected: false, project_id: null, connected_at: null } : { connected: false }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { encryptToken } from '../../../../../../../packages/config/scalewayCredentials.js';
import { ScalewayClient } from '../../../../../../../packages/scaleway/index.js';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import { verifyRequestToken } from '@/lib/auth';

const appSettingsRepo = new AppSettingsRepository();

// POST /api/scaleway/connection — save Scaleway credentials
export async function POST(request: NextRequest) {
  const payload = await verifyRequestToken(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let secretKey: string;
  let projectId: string;
  let zone: string;
  try {
    const body = await request.json();
    secretKey = (body.secret_key ?? '').trim();
    projectId = (body.project_id ?? '').trim();
    zone = (body.zone ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!secretKey || !projectId || !zone) {
    return NextResponse.json({ error: 'secret_key, project_id and zone are required' }, { status: 400 });
  }

  // Verify credentials against the Scaleway API before saving
  try {
    const client = new ScalewayClient(secretKey, projectId);
    const ok = await client.testConnection(zone);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid Scaleway credentials or zone' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not reach Scaleway API' }, { status: 502 });
  }

  try {
    const { enc, iv } = encryptToken(secretKey);
    await appSettingsRepo.updateScalewayConnection({
      scaleway_secret_key_enc: enc,
      scaleway_secret_key_iv: iv,
      scaleway_project_id: projectId,
      scaleway_zone: zone,
      scaleway_connected_by: payload.userId,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/scaleway/connection — soft-disconnect (an already-active
// instance keeps living until its natural 24h expiration; only new
// requests/approvals are blocked from this point on, see requestScalewayDisconnect).
export async function DELETE(request: NextRequest) {
  const payload = await verifyRequestToken(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await appSettingsRepo.requestScalewayDisconnect();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}

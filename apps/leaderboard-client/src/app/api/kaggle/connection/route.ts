import { NextRequest, NextResponse } from 'next/server';
import { encryptToken } from '../../../../../../../packages/config/kaggleCredentials.js';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import { verifyRequestToken } from '@/lib/auth';

const appSettingsRepo = new AppSettingsRepository();

// POST /api/kaggle/connection — save Kaggle credentials
export async function POST(request: NextRequest) {
  const payload = await verifyRequestToken(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let username: string;
  let apiKey: string;
  try {
    const body = await request.json();
    username = (body.username ?? '').trim();
    apiKey = (body.api_key ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!username || !apiKey) {
    return NextResponse.json({ error: 'username and api_key are required' }, { status: 400 });
  }

  // Verify credentials against Kaggle API before saving
  try {
    const testRes = await fetch(
      `https://www.kaggle.com/api/v1/datasets/list?user=${encodeURIComponent(username)}&page=1`,
      {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${username}:${apiKey}`).toString('base64'),
          'Content-Type': 'application/json',
        },
      }
    );
    if (!testRes.ok) {
      return NextResponse.json({ error: 'Invalid Kaggle credentials' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not reach Kaggle API' }, { status: 502 });
  }

  try {
    const { enc, iv } = encryptToken(apiKey);
    await appSettingsRepo.updateKaggleConnection({
      kaggle_username: username,
      kaggle_key_enc: enc,
      kaggle_key_iv: iv,
      kaggle_connected_by: payload.userId,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/kaggle/connection — remove Kaggle credentials
export async function DELETE(request: NextRequest) {
  const payload = await verifyRequestToken(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await appSettingsRepo.clearKaggleConnection();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to clear credentials' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { encryptToken } from '../../../../../../../packages/config/openaiCredentials.js';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import { verifyRequestToken } from '@/lib/auth';

const appSettingsRepo = new AppSettingsRepository();

// POST /api/openai/connection — save OpenAI API key
export async function POST(request: NextRequest) {
  const payload = await verifyRequestToken(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let apiKey: string;
  try {
    const body = await request.json();
    apiKey = (body.api_key ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'api_key is required' }, { status: 400 });
  }

  // Verify the key against OpenAI before saving
  try {
    const testRes = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!testRes.ok) {
      return NextResponse.json({ error: 'Invalid OpenAI API key' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not reach OpenAI API' }, { status: 502 });
  }

  try {
    const { enc, iv } = encryptToken(apiKey);
    await appSettingsRepo.updateOpenAIConnection({
      openai_key_enc: enc,
      openai_key_iv: iv,
      openai_connected_by: payload.userId,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/openai/connection — remove OpenAI API key
export async function DELETE(request: NextRequest) {
  const payload = await verifyRequestToken(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await appSettingsRepo.clearOpenAIConnection();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to clear credentials' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { encryptToken } from '../../../../../../../packages/config/slackCredentials.js';
import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';
import { verifyRequestToken } from '@/lib/auth';

const appSettingsRepo = new AppSettingsRepository();

// POST /api/slack/connection — save Slack bot token
export async function POST(request: NextRequest) {
  const payload = await verifyRequestToken(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let botToken: string;
  try {
    const body = await request.json();
    botToken = (body.bot_token ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!botToken) {
    return NextResponse.json({ error: 'bot_token is required' }, { status: 400 });
  }

  // Verify the token against Slack before saving. Slack returns HTTP 200 with
  // { ok: false } on auth failure, so the body flag is the real check.
  let teamName = '';
  try {
    const testRes = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const data = await testRes.json();
    if (!data.ok) {
      return NextResponse.json({ error: `Invalid Slack token (${data.error ?? 'auth failed'})` }, { status: 400 });
    }
    teamName = data.team ?? '';
  } catch {
    return NextResponse.json({ error: 'Could not reach Slack API' }, { status: 502 });
  }

  try {
    const { enc, iv } = encryptToken(botToken);
    await appSettingsRepo.updateSlackConnection({
      slack_token_enc: enc,
      slack_token_iv: iv,
      slack_team_name: teamName,
      slack_connected_by: payload.userId,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }

  return NextResponse.json({ success: true, team_name: teamName });
}

// DELETE /api/slack/connection — remove Slack bot token
export async function DELETE(request: NextRequest) {
  const payload = await verifyRequestToken(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await appSettingsRepo.clearSlackConnection();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to clear credentials' }, { status: 500 });
  }
}

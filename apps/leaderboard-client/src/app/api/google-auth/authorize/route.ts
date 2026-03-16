import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuthService } from '../../../../../../../packages/services/google-workspace/google-auth.service.js';
import { verifyRequestToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const googleAuthService = new GoogleAuthService();
    const state = JSON.stringify({ user_id: payload.userId });
    const authUrl = googleAuthService.getAuthUrl(state);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('[GoogleAuth] Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}

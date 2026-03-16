import { NextRequest, NextResponse } from 'next/server';
import { GoogleAccountRepository } from '../../../../../../../packages/database-service/repositories/googleAccount.repo.js';
import { verifyRequestToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const googleAccountRepo = new GoogleAccountRepository();
    const googleAccount = await googleAccountRepo.findByUserId(payload.userId);

    if (!googleAccount) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      display_name: googleAccount.display_name,
      email: googleAccount.email,
    });
  } catch (error) {
    console.error('[GoogleAuth] Status error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

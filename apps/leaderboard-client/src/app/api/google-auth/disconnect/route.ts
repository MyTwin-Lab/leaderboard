import { NextRequest, NextResponse } from 'next/server';
import { GoogleAccountRepository } from '../../../../../../../packages/database-service/repositories/googleAccount.repo.js';
import { verifyRequestToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const googleAccountRepo = new GoogleAccountRepository();
    const googleAccount = await googleAccountRepo.findByUserId(payload.userId);
    if (googleAccount) {
      await googleAccountRepo.delete(googleAccount.uuid);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[GoogleAuth] Disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}

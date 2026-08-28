import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepository } from '../../../../../../../../packages/database-service/repositories';

const challengeRepo = new ChallengeRepository();

// POST /api/challenges/[id]/close — clôture le challenge.
// Les récompenses ne sont plus calculées ici : code, ML et validation
// versent toutes en live via le ledger reward_entries.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await challengeRepo.findById(id);
    if (!existing) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    const challenge = await challengeRepo.update(id, { status: 'completed' });
    return NextResponse.json({ success: true, challenge });
  } catch (error) {
    console.error('Error closing challenge:', error);
    return NextResponse.json({ error: 'Failed to close challenge' }, { status: 500 });
  }
}

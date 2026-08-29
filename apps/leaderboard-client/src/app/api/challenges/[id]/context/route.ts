import { NextRequest, NextResponse } from 'next/server';

async function getChallengeService() {
  const { ChallengeService } = await import('../../../../../../../../packages/services/challenge/challenge.service');
  return new ChallengeService();
}

// GET /api/challenges/[id]/context - Récupérer le contexte complet d'un challenge
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const challengeService = await getChallengeService();
    const context = await challengeService.getChallengeContext(id);
    return NextResponse.json(context);
  } catch (error) {
    console.error('Error fetching challenge context:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenge context' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { MeetingAnalysisRepository } from '../../../../../../../../packages/database-service/repositories/meetingAnalysis.repo.js';
import { verifyRequestToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const analysisRepo = new MeetingAnalysisRepository();
    const analysis = await analysisRepo.findByMeetingId(id);

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('[MeetingAnalysis] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
  }
}

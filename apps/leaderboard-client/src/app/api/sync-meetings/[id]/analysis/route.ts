import { NextRequest, NextResponse } from 'next/server';
import { MeetingAnalysisRepository } from '../../../../../../../../packages/database-service/repositories/meetingAnalysis.repo.js';
import { getSessionUser } from '@/lib/auth';
import { moduleNotFoundResponse } from '@/lib/server/modules';
import { loadAccessibleMeeting, toAnalysisView } from '../../meetingAccess';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Module désactivé : la route n'existe pas.
    const disabled = await moduleNotFoundResponse('meetings');
    if (disabled) return disabled;

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const meeting = await loadAccessibleMeeting(id, user);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const analysisRepo = new MeetingAnalysisRepository();
    const analysis = await analysisRepo.findByMeetingId(id);

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    return NextResponse.json({ analysis: toAnalysisView(analysis, user.role === 'admin') });
  } catch (error) {
    console.error('[MeetingAnalysis] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
  }
}

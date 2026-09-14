import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository } from '../../../../../../../packages/database-service/repositories';
import { verifyRequestToken } from '@/lib/auth';

const runsRepo = new EvaluationRunsRepository();

// Helper partagé : une signature valide ne suffit pas (voir lib/sessionClaims.ts).
async function getSession(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const payload = await verifyRequestToken(request);
  return payload ? { userId: payload.userId, role: payload.role } : null;
}

// GET /api/evaluation-runs/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const result = await runsRepo.findWithChallenge(id);
    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching evaluation run:', error);
    return NextResponse.json({ error: 'Failed to fetch evaluation run' }, { status: 500 });
  }
}

// DELETE /api/evaluation-runs/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    await runsRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting evaluation run:', error);
    return NextResponse.json({ error: 'Failed to delete evaluation run' }, { status: 500 });
  }
}

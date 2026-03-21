import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository } from '../../../../../../../packages/database-service/repositories';

const runsRepo = new EvaluationRunsRepository();

// GET /api/evaluation-runs/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await runsRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting evaluation run:', error);
    return NextResponse.json({ error: 'Failed to delete evaluation run' }, { status: 500 });
  }
}

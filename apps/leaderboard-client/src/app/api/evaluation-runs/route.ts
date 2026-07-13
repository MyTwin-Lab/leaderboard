import { NextRequest, NextResponse } from 'next/server';
import { EvaluationRunsRepository } from '../../../../../../packages/database-service/repositories';
import { jwtVerify } from 'jose';

const runsRepo = new EvaluationRunsRepository();

async function getSession(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string, role: payload.role as string };
  } catch {
    return null;
  }
}

// GET /api/evaluation-runs?challengeId=&status=&page=
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('challengeId') ?? undefined;
    const statusParam = searchParams.get('status');
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10);

    const status = statusParam
      ? (statusParam.split(',') as any[])
      : undefined;

    const runs = await runsRepo.findAll({ challengeId, status, page, pageSize });
    return NextResponse.json(runs);
  } catch (error) {
    console.error('Error fetching evaluation runs:', error);
    return NextResponse.json({ error: 'Failed to fetch evaluation runs' }, { status: 500 });
  }
}

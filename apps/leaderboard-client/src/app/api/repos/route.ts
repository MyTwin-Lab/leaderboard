import { NextRequest, NextResponse } from 'next/server';
import { RepoRepository } from '../../../../../../packages/database-service/repositories';
import { verifyRequestToken } from '@/lib/auth';
import { repositories } from '@/lib/db';
import { z } from 'zod';

const repoRepo = new RepoRepository();

const createRepoSchema = z.object({
  title: z.string().min(1),
  type: z.string(),
  external_repo_id: z.string().optional(),
  project_id: z.string().uuid(),
});

// GET /api/repos - Liste tous les repos
export async function GET() {
  try {
    const repos = await repoRepo.findAll();
    return NextResponse.json(repos);
  } catch (error) {
    console.error('Error fetching repos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repos' },
      { status: 500 }
    );
  }
}

// POST /api/repos - Créer un nouveau repo
export async function POST(request: NextRequest) {
  try {
    const session = await verifyRequestToken(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createRepoSchema.parse(body);

    if (session.role !== 'admin') {
      const project = await repositories.project.findById(validated.project_id);
      if (!project || project.manager_id !== session.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    
    const repo = await repoRepo.create(validated);
    return NextResponse.json(repo, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error creating repo:', error);
    return NextResponse.json(
      { error: 'Failed to create repo' },
      { status: 500 }
    );
  }
}

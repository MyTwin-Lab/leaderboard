import { NextRequest, NextResponse } from 'next/server';
import { ProjectRepository } from '../../../../../../packages/database-service/repositories';
import { z } from 'zod';

const projectRepo = new ProjectRepository();

const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

// GET /api/projects - Liste tous les projets
export async function GET() {
  try {
    const projects = await projectRepo.findAll();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Créer un nouveau projet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createProjectSchema.parse(body);
    
    const project = await projectRepo.create(validated);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

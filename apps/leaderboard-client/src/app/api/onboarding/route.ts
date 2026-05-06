import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyRequestToken } from '@/lib/auth';
import { OnboardingProgressRepository } from '../../../../../../packages/database-service/repositories';
import { onboardingStepSchema } from '../../../../../../packages/database-service/domain/schemas_zod';

const onboardingRepo = new OnboardingProgressRepository();

// GET /api/onboarding — Get current user's onboarding progress
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const progress = await onboardingRepo.findByUserId(payload.userId);
    if (!progress) {
      // Auto-init if missing (for users created before onboarding existed)
      const created = await onboardingRepo.initForUser(payload.userId);
      return NextResponse.json(created);
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error('GET /api/onboarding error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/onboarding — Mark a step as complete
export async function PATCH(request: NextRequest) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { step } = z.object({ step: onboardingStepSchema }).parse(body);

    const updated = await onboardingRepo.markStepComplete(payload.userId, step);
    if (!updated) {
      return NextResponse.json({ error: 'Onboarding progress not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }
    console.error('PATCH /api/onboarding error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

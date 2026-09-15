import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import { moduleNotFoundResponse } from '@/lib/server/modules';
import { fetchOnboardingQuests } from '@/lib/server/onboarding';

// GET /api/onboarding — les quêtes installées et leur état pour l'utilisateur
// connecté. Plus de PATCH : une quête se valide côté serveur, par l'événement
// qui la complète (challenge 020, L6).
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const disabled = await moduleNotFoundResponse('onboarding');
    if (disabled) return disabled;

    return NextResponse.json({ quests: await fetchOnboardingQuests(payload.userId) });
  } catch (error) {
    console.error('GET /api/onboarding error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

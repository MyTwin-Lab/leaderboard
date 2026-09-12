import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeTeamRepository,
  UserRepository,
} from '../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';

const userRepo = new UserRepository();
const challengeTeamRepo = new ChallengeTeamRepository();

/** En dessous, la recherche renverrait un dixième de la table pour rien. */
const MIN_TERM_LENGTH = 2;
const MAX_RESULTS = 10;

/**
 * Trois champs, et pas un de plus.
 *
 * `GET /api/users` renvoie `findAll()` — les rows entières, **email et
 * `google_user_id` compris**. Y brancher un sélecteur distribuerait l'adresse
 * de chacun à tout compte connecté. Cette route suit le motif de
 * `lib/public/sandbox.ts` : construite champ par champ, donc une colonne
 * ajoutée plus tard à `users` reste privée par défaut.
 */
interface ContributorSearchResult {
  uuid: string;
  full_name: string;
  avatar_url: string | null;
  /** `already_member` = déjà sur ce challenge. Affiché, pas masqué. */
  blocked_reason: 'already_member' | null;
}

// GET /api/contributors/search?q=&challenge=
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const term = (request.nextUrl.searchParams.get('q') ?? '').trim();
    if (term.length < MIN_TERM_LENGTH) return NextResponse.json({ results: [] });

    const challengeId = request.nextUrl.searchParams.get('challenge');

    // Une ligne de marge : l'appelant est retiré juste après, et sans elle une
    // recherche qui le ramène rendrait neuf résultats au lieu de dix.
    const [found, participants] = await Promise.all([
      userRepo.searchByName(term, MAX_RESULTS + 1),
      challengeId ? challengeTeamRepo.findByChallenge(challengeId) : Promise.resolve([]),
    ]);

    const memberIds = new Set(participants.map((p) => p.user_id));

    const results: ContributorSearchResult[] = found
      .filter((u) => u.uuid !== user.id)
      .slice(0, MAX_RESULTS)
      .map((u) => ({
        uuid: u.uuid,
        full_name: u.full_name,
        avatar_url: u.avatar_url ?? null,
        // Montré et désactivé plutôt que filtré : la question que se pose
        // l'utilisateur est « où est Christyl ? », pas « pourquoi ma recherche
        // ne marche pas ».
        blocked_reason: memberIds.has(u.uuid) ? 'already_member' : null,
      }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Error searching contributors:', err);
    return NextResponse.json({ error: 'Failed to search contributors' }, { status: 500 });
  }
}

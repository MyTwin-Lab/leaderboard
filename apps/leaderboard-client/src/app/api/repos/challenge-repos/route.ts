import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepoRepository, ChallengeRepository, RepoRepository } from '../../../../../../../packages/database-service/repositories';
import { provisionChallengeWorkspace } from '../../../../../../../packages/provisioner/src/index.js';
import { z } from 'zod';

const challengeRepoRepo = new ChallengeRepoRepository();
const challengeRepo = new ChallengeRepository();
const repoRepo = new RepoRepository();

const linkRepoSchema = z.object({
  challenge_id: z.string().uuid(),
  repo_id: z.string().uuid(),
});

// POST /api/repos/challenge-repos - Lier un repo à un challenge
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = linkRepoSchema.parse(body);
    
    // Créer le lien challenge-repo
    const challengeRepoLink = await challengeRepoRepo.create(validated);
    
    // Récupérer les infos du challenge et du repo pour le provisioning
    const [challenge, repo] = await Promise.all([
      challengeRepo.findById(validated.challenge_id),
      repoRepo.findById(validated.repo_id),
    ]);

    if (!challenge || !repo) {
      return NextResponse.json(
        { error: 'Challenge or repo not found' },
        { status: 404 }
      );
    }

    // Provisionner le workspace automatiquement si le repo a un external_repo_id
    let provisioningResult = null;
    if (repo.external_repo_id) {
      try {
        console.log(`[challenge-repos] Provisioning workspace for challenge ${challenge.index}-${challenge.title} on repo ${repo.external_repo_id}`);
        
        provisioningResult = await provisionChallengeWorkspace({
          challengeIndex: challenge.index ?? 0,
          challengeTitle: challenge.title,
          repoExternalId: repo.external_repo_id,
          repoType: repo.type,
        });

        // Mettre à jour le challenge_repo avec les infos du workspace
        await challengeRepoRepo.updateWorkspace(
          validated.challenge_id,
          validated.repo_id,
          {
            workspace_provider: provisioningResult.provider,
            workspace_ref: provisioningResult.ref,
            workspace_url: provisioningResult.url,
            workspace_status: provisioningResult.status,
            workspace_meta: provisioningResult.meta,
          }
        );

        if (provisioningResult.error) {
          console.warn(`[challenge-repos] Provisioning warning: ${provisioningResult.error}`);
        }
      } catch (provisionError) {
        // Log l'erreur mais ne pas faire échouer la création du lien
        console.error('[challenge-repos] Provisioning failed:', provisionError);
        
        // Marquer le workspace comme failed
        await challengeRepoRepo.updateWorkspace(
          validated.challenge_id,
          validated.repo_id,
          {
            workspace_status: 'failed',
            workspace_meta: {
              error: provisionError instanceof Error ? provisionError.message : 'Unknown error',
            },
          }
        );
      }
    }

    return NextResponse.json({
      success: true,
      challenge_repo: challengeRepoLink,
      provisioning: provisioningResult,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error linking repo to challenge:', error);
    return NextResponse.json(
      { error: 'Failed to link repo to challenge' },
      { status: 500 }
    );
  }
}

// DELETE /api/repos/challenge-repos - Délier un repo d'un challenge
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('challenge_id');
    const repoId = searchParams.get('repo_id');

    if (!challengeId || !repoId) {
      return NextResponse.json(
        { error: 'Missing challenge_id or repo_id' },
        { status: 400 }
      );
    }

    await challengeRepoRepo.delete(challengeId, repoId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unlinking repo from challenge:', error);
    return NextResponse.json(
      { error: 'Failed to unlink repo from challenge' },
      { status: 500 }
    );
  }
}

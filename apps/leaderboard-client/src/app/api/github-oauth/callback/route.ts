import type { NextRequest } from 'next/server';
import { handleOAuthCallback } from '@/lib/server/integrations';

// GET /api/github-oauth/callback — compatibilité : l'URL de retour enregistrée
// dans l'application OAuth GitHub (`GITHUB_OAUTH_REDIRECT_URI`). Même traitement
// que `/api/integrations/github/callback`, qui la remplacera quand l'application
// OAuth et la variable d'environnement auront été mises à jour (L7).
export async function GET(request: NextRequest) {
  return handleOAuthCallback(request, 'github');
}

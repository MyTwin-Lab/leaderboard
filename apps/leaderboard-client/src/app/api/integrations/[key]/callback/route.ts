import type { NextRequest } from 'next/server';
import { handleOAuthCallback } from '@/lib/server/integrations';

type Params = { params: Promise<{ key: string }> };

// GET /api/integrations/[key]/callback — retour de l'OAuth du fournisseur.
export async function GET(request: NextRequest, { params }: Params) {
  const { key } = await params;
  return handleOAuthCallback(request, key);
}

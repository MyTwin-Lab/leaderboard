import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SlugTakenError,
  looksLikeUuid,
  slugProblem,
  slugify,
} from "../../../../../packages/database-service/domain/slug";

/**
 * Le slug dans les schémas Zod des routes de l'app.
 *
 * Redéfini ici plutôt qu'importé de `schemas_zod.ts` : l'app et les packages
 * résolvent deux instances de Zod, et un schéma de l'une imbriqué dans un
 * `z.object` de l'autre casse les vérifications structurelles de tsc (voir
 * `api/challenges/[id]/route.ts`). La règle, elle, reste celle de `slugProblem`.
 */
export const slugField = z.string().superRefine((value, ctx) => {
  const problem = slugProblem(value);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

/**
 * 409 pour un slug déjà pris, avec la suggestion que le formulaire propose
 * d'un clic. `null` pour toute autre erreur, que l'appelant relaie.
 */
export function slugTakenResponse(error: unknown): NextResponse | null {
  if (!(error instanceof SlugTakenError)) return null;
  return NextResponse.json(
    { error: error.message, field: "slug", suggestion: error.suggestion },
    { status: 409 },
  );
}

export interface SlugAvailability {
  slug: string;
  available: boolean;
  /** Pourquoi il ne l'est pas, en une phrase affichable. */
  problem: string | null;
  /** Un slug libre à proposer à la place, quand `available` est faux. */
  suggestion: string | null;
}

interface SlugRepository {
  isSlugTaken(slug: string, exceptId?: string): Promise<boolean>;
  availableSlug(base: string, exceptId?: string): Promise<string>;
}

/**
 * La réponse des deux endpoints `slug-availability`.
 *
 * `exclude` est la ligne en cours d'édition : son slug et ses anciens slugs
 * restent disponibles pour elle. Ignoré s'il n'a pas la forme d'un UUID, pour
 * qu'une valeur fantaisiste ne fasse pas échouer la requête SQL.
 */
export async function checkSlugAvailability(
  repo: SlugRepository,
  slug: string,
  fallback: string,
  exclude: string | null,
): Promise<SlugAvailability> {
  const exceptId = exclude && looksLikeUuid(exclude) ? exclude : undefined;

  const problem = slugProblem(slug);
  if (problem) {
    return {
      slug,
      available: false,
      problem,
      suggestion: await repo.availableSlug(slugify(slug, fallback), exceptId),
    };
  }

  if (await repo.isSlugTaken(slug, exceptId)) {
    return {
      slug,
      available: false,
      problem: "This address is already taken.",
      suggestion: await repo.availableSlug(slug, exceptId),
    };
  }

  return { slug, available: true, problem: null, suggestion: null };
}

import "server-only";

import { cache } from "react";
import { repositories } from "@/lib/db";
import { isValidSlug, looksLikeUuid } from "../../../../../packages/database-service/domain/slug";
import type { Challenge, Sandbox } from "../../../../../packages/database-service/domain/entities";

/**
 * Ce que désigne le segment d'URL d'une page de challenge ou de sandbox.
 *
 * - `found` : le slug courant — la page se rend ;
 * - `moved` : un UUID (les URLs d'avant les slugs), un ancien slug, ou un slug
 *   en majuscules — la page redirige en 308 vers `slug` ;
 * - `missing` : rien — la page répond un vrai 404.
 *
 * La résolution ignore la visibilité : un brouillon s'ouvre à son slug pour son
 * manager, comme il s'ouvrait à son UUID. Ce qu'un visiteur voit reste décidé
 * par l'API (`lib/public/*`) et par `lib/server/seo.ts`.
 */
export type PageRef<T> =
  | { kind: "found"; entity: T }
  | { kind: "moved"; slug: string }
  | { kind: "missing" };

interface SluggedRepository<T extends { slug: string }> {
  findBySlug(slug: string): Promise<T | null>;
  findById(uuid: string): Promise<T | null>;
  findSlugRedirect(slug: string): Promise<string | null>;
}

async function resolve<T extends { slug: string }>(repo: SluggedRepository<T>, param: string): Promise<PageRef<T>> {
  if (isValidSlug(param)) {
    const entity = await repo.findBySlug(param);
    if (entity) return { kind: "found", entity };
  }

  if (looksLikeUuid(param)) {
    const entity = await repo.findById(param.toLowerCase());
    return entity ? { kind: "moved", slug: entity.slug } : { kind: "missing" };
  }

  // Un lien retapé à la main ou passé par un outil qui capitalise.
  const lowered = param.toLowerCase();
  if (lowered !== param && isValidSlug(lowered)) {
    const entity = await repo.findBySlug(lowered);
    if (entity) return { kind: "moved", slug: entity.slug };
  }

  const formerOwner = await repo.findSlugRedirect(lowered);
  if (formerOwner) {
    const entity = await repo.findById(formerOwner);
    if (entity) return { kind: "moved", slug: entity.slug };
  }

  return { kind: "missing" };
}

// `cache` : le layout (métadonnées, JSON-LD) et la page résolvent le même
// segment pendant le même rendu — une seule série de requêtes pour les deux.
export const resolveChallengeRef = cache(
  (param: string): Promise<PageRef<Challenge>> => resolve(repositories.challenge, param),
);

export const resolveSandboxRef = cache(
  (param: string): Promise<PageRef<Sandbox>> => resolve(repositories.sandbox, param),
);

import "server-only";

import { cache } from "react";
import type { Metadata, MetadataRoute } from "next";
import { repositories } from "@/lib/db";
import { isPubliclyVisible } from "@/lib/public/challengeVisibility";
import { canSeeSandbox, sandboxViewer } from "@/lib/server/sandboxAuth";
import {
  SITE_URL,
  breadcrumbJsonLd,
  buildSitemap,
  jsonLdGraph,
  pageMetadata,
  toMetaDescription,
  unindexedMetadata,
} from "@/lib/seo";

/**
 * Métadonnées des pages dont le titre dépend de la base, et contenu du sitemap.
 *
 * Tout est décidé du point de vue d'un visiteur anonyme, session ou non : le
 * `<head>` est servi à quiconque demande la page, et les moteurs n'ont jamais
 * de compte. Ce qu'un anonyme ne peut pas ouvrir (brouillon, challenge de
 * validation, sandbox archivé) ne voit donc ni son titre publié, ni son URL
 * listée — et reçoit `noindex`.
 */
const ANONYMOUS = sandboxViewer(null, null);

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  code: "Code",
  ml: "Machine learning",
};

/**
 * Une lecture qui échoue (base indisponible, identifiant qui n'est pas un UUID)
 * ne doit pas faire tomber la page : elle retombe sur des métadonnées neutres.
 */
async function safely<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    console.error("[seo] metadata lookup failed", error);
    return null;
  }
}

// `cache` : `generateMetadata` et le JSON-LD du layout lisent la même ligne
// pendant le même rendu — une seule requête pour les deux.
const publicChallenge = cache(async (id: string) => {
  const challenge = await safely(() => repositories.challenge.findById(id));
  return challenge && isPubliclyVisible(challenge) ? challenge : null;
});

const publicSandbox = cache(async (id: string) => {
  const sandbox = await safely(() => repositories.sandbox.findById(id));
  return sandbox && canSeeSandbox(sandbox, ANONYMOUS) ? sandbox : null;
});

export async function challengeMetadata(id: string): Promise<Metadata> {
  const challenge = await publicChallenge(id);
  if (!challenge) return unindexedMetadata("Challenges");

  const typeLabel = CHALLENGE_TYPE_LABELS[challenge.type] ?? "Open";
  return pageMetadata({
    title: challenge.title,
    description:
      toMetaDescription(challenge.description)
      ?? `${typeLabel} challenge at MyTwin Lab: contribute, get evaluated and earn contribution points (CP).`,
    path: `/challenges/${challenge.uuid}`,
  });
}

export async function sandboxMetadata(id: string): Promise<Metadata> {
  const sandbox = await publicSandbox(id);
  if (!sandbox) return unindexedMetadata("Sandbox");

  return pageMetadata({
    title: sandbox.title,
    description:
      toMetaDescription(sandbox.context)
      ?? toMetaDescription(sandbox.why)
      ?? toMetaDescription(sandbox.goals.join(". "))
      ?? "A community project on the MyTwin Lab Sandbox: star it if you want it built.",
    path: `/sandbox/${sandbox.uuid}`,
  });
}

/** `null` quand la page n'est pas publique : rien à décrire aux moteurs. */
export async function challengeJsonLd(id: string) {
  const challenge = await publicChallenge(id);
  if (!challenge) return null;

  return jsonLdGraph(
    breadcrumbJsonLd([
      { name: "MyTwin Lab", path: "/" },
      { name: "Challenges", path: "/challenges" },
      { name: challenge.title, path: `/challenges/${challenge.uuid}` },
    ]),
  );
}

export async function sandboxJsonLd(id: string) {
  const sandbox = await publicSandbox(id);
  if (!sandbox) return null;

  return jsonLdGraph(
    breadcrumbJsonLd([
      { name: "MyTwin Lab", path: "/" },
      { name: "Sandbox", path: "/sandbox" },
      { name: sandbox.title, path: `/sandbox/${sandbox.uuid}` },
    ]),
  );
}

/**
 * Un profil reste public — c'est le classement qui le rend visible — mais hors
 * de l'index : il expose le nom d'une personne pour un contenu mince, et
 * disperserait le poids du site loin des pages qui comptent. `follow` reste
 * vrai, pour que les liens du profil vers les challenges gardent leur valeur.
 */
export async function contributorMetadata(userId: string): Promise<Metadata> {
  const user = await safely(() => repositories.user.findById(userId));
  if (!user) return unindexedMetadata("Contributor");

  const name = user.full_name?.trim() || "Contributor";
  return {
    ...pageMetadata({
      title: name,
      description:
        toMetaDescription(user.bio)
        ?? `${name}'s contributions to MyTwin Lab, tracked, evaluated and rewarded in CP.`,
      path: `/contributors/${user.uuid}`,
    }),
    robots: { index: false, follow: true },
  };
}

export async function fetchSitemap(): Promise<MetadataRoute.Sitemap> {
  const [challenges, sandboxes] = await Promise.all([
    repositories.challenge.findAll(),
    repositories.sandbox.findAll(),
  ]);

  return buildSitemap({
    baseUrl: SITE_URL,
    challenges: challenges.filter(isPubliclyVisible),
    sandboxes: sandboxes.filter((sandbox) => canSeeSandbox(sandbox, ANONYMOUS)),
  });
}

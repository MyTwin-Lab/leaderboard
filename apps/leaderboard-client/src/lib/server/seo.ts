import "server-only";

import type { Metadata, MetadataRoute } from "next";
import { repositories } from "@/lib/db";
import { isPubliclyVisible } from "@/lib/public/challengeVisibility";
import { canSeeSandbox, sandboxViewer } from "@/lib/server/sandboxAuth";
import { fetchLeaderboard } from "@/lib/server/leaderboard";
import { buildSitemap, pageMetadata, siteUrl, toMetaDescription, unindexedMetadata } from "@/lib/seo";

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

export async function challengeMetadata(id: string): Promise<Metadata> {
  const challenge = await safely(() => repositories.challenge.findById(id));
  if (!challenge || !isPubliclyVisible(challenge)) return unindexedMetadata("Challenges");

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
  const sandbox = await safely(() => repositories.sandbox.findById(id));
  if (!sandbox || !canSeeSandbox(sandbox, ANONYMOUS)) return unindexedMetadata("Sandbox");

  return pageMetadata({
    title: sandbox.title,
    description:
      toMetaDescription(sandbox.context)
      ?? toMetaDescription(sandbox.why)
      ?? toMetaDescription(sandbox.goals.join(". "))
      ?? "A community proposal on the MyTwin Lab sandbox: star it if you want it built.",
    path: `/sandbox/${sandbox.uuid}`,
  });
}

export async function contributorMetadata(userId: string): Promise<Metadata> {
  const user = await safely(() => repositories.user.findById(userId));
  if (!user) return unindexedMetadata("Contributor");

  const name = user.full_name?.trim() || "Contributor";
  return pageMetadata({
    title: name,
    description:
      toMetaDescription(user.bio)
      ?? `${name}'s contributions to MyTwin Lab, tracked, evaluated and rewarded in CP.`,
    path: `/contributors/${user.uuid}`,
  });
}

/**
 * Les contributeurs listés sont ceux qui ont gagné des CP : un profil vide
 * n'apporte rien à un moteur, et le classement est ce qui les rend publics.
 */
export async function fetchSitemap(): Promise<MetadataRoute.Sitemap> {
  const [challenges, sandboxes, leaderboard] = await Promise.all([
    repositories.challenge.findAll(),
    repositories.sandbox.findAll(),
    fetchLeaderboard(),
  ]);

  return buildSitemap({
    baseUrl: siteUrl(),
    challenges: challenges.filter(isPubliclyVisible),
    sandboxes: sandboxes.filter((sandbox) => canSeeSandbox(sandbox, ANONYMOUS)),
    contributorIds: leaderboard.entries.filter((entry) => entry.totalCP > 0).map((entry) => entry.userId),
  });
}

import type { ActionContext } from "../../../../packages/registry/platform.js";
import {
  ChallengeRepoRepository,
  UserRepository,
  ContributionRepository,
  ChallengeTeamRepository,
  RewardEntryRepository,
} from "../../../../packages/database-service/repositories/index.js";
import type { ChallengeRepoRole } from "../../../../packages/database-service/domain/entities.js";
import { parseMlRewardRules } from "../../../../packages/database-service/domain/mlRewardRules.js";
import { ML_ROLE_RULE } from "../../../../packages/services/challenge/mlRoles.js";
import { normalizeArtifactUrl } from "../../../../packages/services/challenge/artifactUrl.js";
import { resolveWorkspaceOwner } from "../../../../packages/capabilities/groups.js";

/** Rôles fermés une fois le seuil de métrique du challenge atteint. */
const BLOCKABLE_ROLES: ChallengeRepoRole[] = ["dataset", "model", "model_code"];

/*
 * Rôle du repo → contribution qu'il alimente : `ML_ROLE_RULE`, la table
 * partagée du flux ML.
 *
 * L'étape modèle a deux repos (Kaggle + GitHub) mais une seule contribution :
 * les deux notes s'additionnent sur la même ligne, jusqu'à `model.cap`.
 *
 * La table vit dans `packages/services/challenge/mlRoles.ts` parce que la
 * promotion d'un sandbox reprend le travail de l'auteur en écrivant les mêmes
 * contributions : une contribution reprise doit être indistinguable d'une
 * contribution soumise ici.
 */

const challengeRepoRepo = new ChallengeRepoRepository();
const contributionRepo = new ContributionRepository();
const userRepo = new UserRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const rewardRepo = new RewardEntryRepository();

/** `GET workspace` — les repos du challenge, avec les URLs soumises par participant. */
export async function readWorkspace({ challenge, user }: ActionContext) {
  const challengeId = challenge.uuid;
  const repos = await challengeRepoRepo.findByChallengeWithRepo(challengeId);

  const allUserIds = new Set<string>();
  for (const r of repos) {
    const userUrls = (r.workspace_meta as { userUrls?: Record<string, string> } | null)?.userUrls ?? {};
    Object.keys(userUrls).forEach((uid) => allUserIds.add(uid));
  }

  const submitterUsers = await userRepo.findByIds([...allUserIds]);
  const usersMap = Object.fromEntries(
    submitterUsers.map((u) => [u.uuid, { fullName: u.full_name, avatarUrl: u.avatar_url ?? undefined }])
  );

  // Le workspace lu par le front est celui du groupe : les URLs vivent sous
  // le porteur, pas sous chaque membre. `currentUserId` reste l'identité de
  // l'appelant, `workspaceOwnerId` la clé de lecture de workspace_meta.
  const workspaceOwnerId = await resolveWorkspaceOwner(challengeId, user.id, { challengeTeamRepo });

  return {
    currentUserId: user.id,
    workspaceOwnerId,
    repos: repos.map((r) => ({
      repo_id: r.repo_id,
      repo_type: r.repo_type,
      repo_external_id: r.repo_external_id,
      role: r.role ?? null,
      workspace_meta: r.workspace_meta ?? {},
    })),
    users: usersMap,
  };
}

/** `PATCH workspace` — enregistre l'URL de l'appelant (ou de son groupe) pour une étape. */
export async function submitWorkspace({ request, challenge, user }: ActionContext) {
  const challengeId = challenge.uuid;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "repo_id is required" }, { status: 400 });
  }
  const { repo_id, workspace_url, dataset_urls } = body;

  if (!repo_id || typeof repo_id !== "string") {
    return Response.json({ error: "repo_id is required" }, { status: 400 });
  }
  const hasWorkspaceUrl = Object.prototype.hasOwnProperty.call(body, "workspace_url");
  const hasDatasetUrls = Object.prototype.hasOwnProperty.call(body, "dataset_urls");
  if (!hasWorkspaceUrl && !hasDatasetUrls) {
    return Response.json({ error: "workspace_url or dataset_urls is required" }, { status: 400 });
  }
  if (hasWorkspaceUrl && workspace_url !== null && (typeof workspace_url !== "string" || !workspace_url.trim())) {
    return Response.json({ error: "workspace_url must be a non-empty string or null" }, { status: 400 });
  }
  const isValidDatasetUrls =
    dataset_urls === null ||
    (Array.isArray(dataset_urls) && dataset_urls.every((u) => typeof u === "string" && u.trim()));
  if (hasDatasetUrls && !isValidDatasetUrls) {
    return Response.json({ error: "dataset_urls must be an array of non-empty strings, or null" }, { status: 400 });
  }

  const existing = await challengeRepoRepo.findByChallengeAndRepo(challengeId, repo_id);
  if (!existing) {
    return Response.json({ error: "Repo not found for this challenge" }, { status: 404 });
  }
  if (hasDatasetUrls && existing.role !== "dataset") {
    return Response.json({ error: "dataset_urls only applies to dataset repos" }, { status: 400 });
  }

  // Une fois le seuil de métrique atteint, les soumissions dataset/modèle se
  // ferment — seul le packaging d'API reste ouvert. Seules les vraies
  // soumissions (une workspace_url non nulle) sont bloquées : effacer sa
  // propre URL et cocher un dataset communautaire restent permis.
  if (hasWorkspaceUrl && workspace_url !== null && existing.role && BLOCKABLE_ROLES.includes(existing.role)) {
    const mlRules = parseMlRewardRules(challenge.reward_rules);
    const threshold = mlRules?.model.metric.blockThreshold;
    if (threshold != null) {
      const best = await rewardRepo.maxMetaNumber(challengeId, { ruleKey: "model_metric", field: "metricValue" });
      if (best != null && best >= threshold) {
        return Response.json(
          { error: "Metric threshold reached - dataset and model submissions are closed, only API packaging is accepted" },
          { status: 403 }
        );
      }
    }
  }

  // Un challenge ML n'a pas de tâches : soumettre par le workspace est ce qui
  // fait de quelqu'un un participant. Fait seulement une fois la requête
  // validée, pour qu'un PATCH refusé n'ait aucun effet.
  const existingTeam = await challengeTeamRepo.findByChallenge(challengeId);
  if (!existingTeam.some((m) => m.user_id === user.id)) {
    await challengeTeamRepo.create({ challenge_id: challengeId, user_id: user.id });
  }

  // Un groupe partage sa vue de progression : dataset choisi, URL Kaggle,
  // code GitHub et endpoint vivent sous le porteur, pas sous chaque membre.
  // Résolu après le join implicite ci-dessus, qui peut créer la row.
  const ownerId = await resolveWorkspaceOwner(challengeId, user.id, { challengeTeamRepo });

  let current = existing;

  if (hasWorkspaceUrl) {
    const existingMeta = (current.workspace_meta as Record<string, unknown>) ?? {};
    const existingUserUrls = (existingMeta.userUrls as Record<string, string>) ?? {};
    const previousOwnUrl = existingUserUrls[ownerId];

    // null = retirer l'URL (réinitialiser l'étape)
    const updatedUserUrls = { ...existingUserUrls };
    if (workspace_url === null) {
      delete updatedUserUrls[ownerId];
    } else {
      updatedUserUrls[ownerId] = workspace_url.trim();
    }

    const updatedMeta: Record<string, unknown> = { ...existingMeta, userUrls: updatedUserUrls };

    // Étape dataset : garder l'ensemble multi-sélection (datasetUrls, lu pour
    // répartir la récompense d'un modèle) aligné sur l'URL propre saisie —
    // remplacer l'ancienne entrée propre, ou la retirer, sans toucher aux
    // datasets communautaires déjà cochés.
    if (existing.role === "dataset") {
      const existingDatasetUrls = (existingMeta.datasetUrls as Record<string, string[]>) ?? {};
      const mySet = new Set(existingDatasetUrls[ownerId] ?? []);
      if (previousOwnUrl) mySet.delete(previousOwnUrl);
      if (workspace_url !== null) mySet.add(workspace_url.trim());

      const updatedDatasetUrls = { ...existingDatasetUrls };
      if (mySet.size > 0) {
        updatedDatasetUrls[ownerId] = [...mySet];
      } else {
        delete updatedDatasetUrls[ownerId];
      }
      // Pas de clé vide quand la multi-sélection n'a jamais servi sur ce repo.
      if (Object.keys(updatedDatasetUrls).length > 0 || "datasetUrls" in existingMeta) {
        updatedMeta.datasetUrls = updatedDatasetUrls;
      }
    }

    current = (await challengeRepoRepo.updateWorkspace(challengeId, repo_id, {
      workspace_meta: updatedMeta,
    })) ?? current;
  }

  // Étape dataset seulement — cocher ou décocher un dataset communautaire.
  // Ne touche ni userUrls, ni la contribution, ni l'attribution : seulement la
  // répartition d'une future récompense de modèle.
  if (hasDatasetUrls) {
    const existingMeta = (current.workspace_meta as Record<string, unknown>) ?? {};
    const existingDatasetUrls = (existingMeta.datasetUrls as Record<string, string[]>) ?? {};

    const updatedDatasetUrls = { ...existingDatasetUrls };
    if (dataset_urls === null || dataset_urls.length === 0) {
      delete updatedDatasetUrls[ownerId];
    } else {
      updatedDatasetUrls[ownerId] = [...new Set<string>(dataset_urls.map((u: string) => u.trim()))];
    }

    const updatedMeta = { ...existingMeta, datasetUrls: updatedDatasetUrls };

    current = (await challengeRepoRepo.updateWorkspace(challengeId, repo_id, {
      workspace_meta: updatedMeta,
    })) ?? current;
  }

  // Crée ou met à jour la contribution de l'étape.
  if (hasWorkspaceUrl && workspace_url !== null && existing.role) {
    const cfg = ML_ROLE_RULE[existing.role];
    if (cfg) {
      const url = workspace_url.trim();
      const challengeContribs = await contributionRepo.findByChallenge(challengeId);
      const contribution = challengeContribs.find(
        (c) => c.user_id === ownerId && c.type === cfg.contributionType
      );

      // La description rassemble tous les repos de l'étape : un modèle montre
      // ses liens Kaggle et GitHub sur une seule contribution.
      const allRepos = await challengeRepoRepo.findByChallengeWithRepo(challengeId);
      const stepRepos = allRepos.filter(
        (r) => r.role && ML_ROLE_RULE[r.role]?.contributionType === cfg.contributionType
      );
      const description = stepRepos
        .map((r) => {
          const urls = (r.workspace_meta as { userUrls?: Record<string, string> } | null)?.userUrls ?? {};
          const u = r.repo_id === repo_id ? url : urls[ownerId];
          return u ? `${r.role}: ${u}` : null;
        })
        .filter(Boolean)
        .join("\n");

      const artifactPatch = cfg.isArtifact ? { artifact_url: normalizeArtifactUrl(url) } : {};

      if (contribution) {
        await contributionRepo.update(contribution.uuid, {
          description,
          evaluation_status: "pending",
          ...artifactPatch,
        });
      } else {
        await contributionRepo.create({
          title: cfg.title,
          type: cfg.contributionType,
          description,
          reward: 0,
          user_id: ownerId,
          challenge_id: challengeId,
          submitted_at: new Date(),
          evaluation_status: "pending",
          ...artifactPatch,
        });
      }

      // Les points s'attribuent au fil de l'eau, mais l'appel à l'agent prend
      // des dizaines de secondes : la progression vit sur evaluation_status.
      const { MlRewardsService } = await import("../../../../packages/services/challenge/ml-rewards.service.js");
      new MlRewardsService().scheduleAward({
        challengeId,
        userId: user.id, // le service re-résout le porteur lui-même
        repoId: repo_id,
        url,
      });
    }
  }

  return { repo: current };
}

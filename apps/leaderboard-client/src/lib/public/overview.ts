/**
 * Reduces the overview payload to what an anonymous visitor may see.
 *
 * Built field by field on purpose. A denylist that deleted the sensitive keys
 * would publish, by default, every column a repository starts returning later;
 * here a new field is private until someone writes it into this file.
 *
 * Task titles are excluded: personal boards carry contributors' own wording.
 * "{done}/{total} tasks" needs only `status` and `user_id`.
 *
 * Meetings and repos are dropped wholesale — a meeting carries a joinable
 * link, and a repo row carries workspace metadata.
 */
export interface PublicOverview {
  challenge: {
    uuid: string; title: string; description: string | null; status: string;
    type: string; start_date: string | null; end_date: string | null;
    contribution_points_reward: number; project_id: string;
    workspace_mode: string | null;
  };
  team: Array<{ uuid: string; full_name: string; avatar_url: string | null; github_username: string | null }>;
  tasks: Array<{ uuid: string; user_id: string | null; status: string; parent_task_id: string | null }>;
  participants: Array<{ user_id: string; group_owner_id: string | null }>;
  contributions: Array<{
    uuid: string; user_id: string; type: string; reward: number;
    submitted_at: string; evaluation_status: string | null;
  }>;
}

export type PublicTeamMember = PublicOverview['team'][number];

/** Un membre d'équipe tel que la page le montre : ni email, ni `google_user_id`, ni rôle. */
export function toPublicTeamMember(m: any): PublicTeamMember {
  return {
    uuid: m.uuid,
    full_name: m.full_name,
    avatar_url: m.avatar_url ?? null,
    github_username: m.github_username ?? null,
  };
}

export function toPublicOverview(data: any): PublicOverview {
  const c = data?.challenge ?? {};

  return {
    challenge: {
      uuid: c.uuid,
      title: c.title,
      description: c.description ?? null,
      status: c.status,
      type: c.type,
      start_date: c.start_date ?? null,
      end_date: c.end_date ?? null,
      contribution_points_reward: c.contribution_points_reward ?? 0,
      project_id: c.project_id,
      workspace_mode: c.workspace_mode ?? null,
    },
    team: (data?.team ?? []).map(toPublicTeamMember),
    tasks: (data?.tasks ?? []).map(toTaskProgress),
    // `group_owner_id` seulement : il dit qui travaille avec qui, à partir
    // d'un user_id déjà publié. `group_id`, le jeton d'invitation, ne sort pas.
    participants: (data?.participants ?? []).map((p: any) => ({
      user_id: p.user_id,
      group_owner_id: p.group_owner_id ?? null,
    })),
    contributions: (data?.contributions ?? []).map((k: any) => ({
      uuid: k.uuid,
      user_id: k.user_id,
      type: k.type,
      reward: k.reward ?? 0,
      submitted_at: k.submitted_at,
      evaluation_status: k.evaluation_status ?? null,
    })),
  };
}

/** Juste de quoi compter "{done}/{total}" : sans titre ni description. */
function toTaskProgress(t: any): PublicOverview['tasks'][number] {
  return {
    uuid: t.uuid,
    user_id: t.user_id ?? null,
    status: t.status,
    parent_task_id: t.parent_task_id ?? null,
  };
}

export interface SignedInViewer {
  userId: string;
  role: string;
  /** Porteur du workspace du visiteur : lui-même en solo, le porteur du groupe sinon. */
  workspaceOwnerId: string | null;
  /** Le visiteur figure dans `participants`. */
  isMember: boolean;
  /** Admin, ou manager du projet du challenge : la vue de pilotage lit tout. */
  privileged: boolean;
}

/**
 * Réduit l'overview à ce qu'un visiteur connecté peut voir.
 *
 * Même principe que `toPublicOverview` : liste blanche, champ par champ. Les
 * deux pages qui partagent la clé `['challenge-overview', id]` reçoivent donc
 * une forme qui dépend du visiteur, pas de la page — la vue manager n'est
 * ouverte qu'aux utilisateurs `privileged`, qui gardent tasks, participants et
 * meetings entiers.
 *
 * "Le mien" (`mine`) = le visiteur et le porteur de son workspace : en groupe,
 * le board, la branche et la contribution appartiennent au porteur.
 */
export function toSignedInOverview(data: any, viewer: SignedInViewer) {
  const { userId, role, workspaceOwnerId, isMember, privileged } = viewer;
  const isAdmin = role === 'admin';
  const mine = new Set([userId, workspaceOwnerId].filter((v): v is string => !!v));

  return {
    // La ligne que `GET /api/challenges/[id]` sert déjà à toute session ; la
    // vue manager en édite tous les champs (roadmap, reward_rules…).
    challenge: data?.challenge ?? null,
    team: (data?.team ?? []).map(toPublicTeamMember),
    tasks: (data?.tasks ?? []).map((t: any) =>
      // Template (sans user_id) ou board du visiteur : complet. Le board d'un
      // autre contributeur ne sert qu'à sa progression.
      privileged || !t.user_id || mine.has(t.user_id) ? t : toTaskProgress(t)
    ),
    participants: (data?.participants ?? []).map((p: any) => {
      // `group_id` a déjà été masqué par la route, sauf sur la ligne du visiteur.
      if (privileged) return p;
      const row: Record<string, unknown> = {
        user_id: p.user_id,
        group_id: p.group_id,
        group_owner_id: p.group_owner_id ?? null,
      };
      if (mine.has(p.user_id)) {
        row.workspace_provider = p.workspace_provider;
        row.workspace_ref = p.workspace_ref;
        row.workspace_url = p.workspace_url;
        row.workspace_status = p.workspace_status;
      }
      return row;
    }),
    meetings: (data?.meetings ?? []).map((m: any) => {
      if (privileged) return m;
      const row: Record<string, unknown> = {
        uuid: m.uuid,
        title: m.title,
        description: m.description,
        challenge_id: m.challenge_id,
        start_time: m.start_time,
        end_time: m.end_time,
        status: m.status,
      };
      // Le lien Meet permet d'entrer dans la réunion : réservé aux membres.
      // Les identifiants calendrier et conférence ne servent à aucune page.
      if (isMember) {
        row.meet_link = m.meet_link;
        row.created_by = m.created_by;
      }
      return row;
    }),
    // `workspace_meta` porte les URLs de chaque contributeur : la page n'a
    // besoin que du type de repo.
    repos: (data?.repos ?? []).map((r: any) => ({
      repo_id: r.repo_id,
      role: r.role ?? null,
      repo_type: r.repo_type,
      repo_title: r.repo_title,
    })),
    contributions: (data?.contributions ?? []).map((k: any) => ({
      uuid: k.uuid,
      title: k.title,
      type: k.type,
      description: k.description,
      tags: k.tags,
      reward: k.reward ?? 0,
      user_id: k.user_id,
      challenge_id: k.challenge_id,
      task_id: k.task_id,
      artifact_url: k.artifact_url,
      live_endpoint_url: k.live_endpoint_url,
      evaluation_status: k.evaluation_status ?? null,
      submitted_at: k.submitted_at,
      created_at: k.created_at,
      // Scores et commentaires IA : à l'auteur (ou à son groupe) et aux admins,
      // comme `GET /api/contributions/[id]`.
      evaluation: isAdmin || mine.has(k.user_id) ? k.evaluation ?? null : null,
    })),
    my_workspace_owner_id: data?.my_workspace_owner_id ?? null,
    contribution_members: (data?.contribution_members ?? []).map((m: any) => ({
      contribution_id: m.contribution_id,
      user_id: m.user_id,
    })),
    source_challenge_type: data?.source_challenge_type ?? null,
  };
}

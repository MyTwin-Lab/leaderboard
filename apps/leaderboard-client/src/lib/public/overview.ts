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
    team: (data?.team ?? []).map((m: any) => ({
      uuid: m.uuid,
      full_name: m.full_name,
      avatar_url: m.avatar_url ?? null,
      github_username: m.github_username ?? null,
    })),
    tasks: (data?.tasks ?? []).map((t: any) => ({
      uuid: t.uuid,
      user_id: t.user_id ?? null,
      status: t.status,
      parent_task_id: t.parent_task_id ?? null,
    })),
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

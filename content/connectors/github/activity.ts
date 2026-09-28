import { activityPayloads } from "../../../packages/connectors/activity.js";

/**
 * Activité d'un dépôt GitHub
 * --------------------------
 * La forme du `payload` que rend `GitHubExternalConnector.fetchRepoActivity`,
 * et ce qui sait la lire : le filtrage public et l'extraction des événements.
 * Pur, sans Octokit : le client l'importe par la distribution.
 */

export const GITHUB_CONNECTOR_KEY = "github";

export type GitHubEventType = "commit" | "pull_request" | "pr_review" | "branch_created";

export interface GitHubEvent {
  type: GitHubEventType;
  id: string;
  title: string;
  author: string; // GitHub login
  date: string; // ISO 8601
  url: string;
  metadata: {
    sha?: string;
    additions?: number;
    deletions?: number;
    prNumber?: number;
    state?: "open" | "closed" | "merged";
    reviewState?: "approved" | "changes_requested" | "commented";
    branchName?: string;
  };
}

export interface GitHubActivityPayload {
  /** Du plus récent au plus ancien. */
  events: GitHubEvent[];
}

/**
 * Ce qu'un visiteur anonyme peut voir. `metadata.branchName` nomme la branche
 * `contrib/<index>-<username>` que le provisioner crée pour chaque
 * contributeur, et un `branch_created` n'existe que pour l'annoncer : le champ
 * et le type d'événement disparaissent tous deux.
 */
const PUBLIC_EVENT_TYPES = new Set<string>(["commit", "pull_request", "pr_review"]);

function toPublicEvent(event: GitHubEvent): GitHubEvent {
  const m = event.metadata ?? {};
  return {
    type: event.type,
    id: event.id,
    title: event.title,
    author: event.author,
    date: event.date,
    url: event.url,
    metadata: {
      ...(m.sha !== undefined && { sha: m.sha }),
      ...(m.additions !== undefined && { additions: m.additions }),
      ...(m.deletions !== undefined && { deletions: m.deletions }),
      ...(m.prNumber !== undefined && { prNumber: m.prNumber }),
      ...(m.state !== undefined && { state: m.state }),
      ...(m.reviewState !== undefined && { reviewState: m.reviewState }),
    },
  };
}

export function toPublicGithubActivity(payload: unknown): GitHubActivityPayload {
  const events = (payload as Partial<GitHubActivityPayload> | null)?.events ?? [];
  return {
    events: events.filter((event) => PUBLIC_EVENT_TYPES.has(event?.type)).map(toPublicEvent),
  };
}

/** Les événements du premier dépôt GitHub d'un challenge. */
export function githubEventsOf(activities: Record<string, unknown> | null | undefined): GitHubEvent[] {
  const [payload] = activityPayloads(activities, GITHUB_CONNECTOR_KEY) as Partial<GitHubActivityPayload>[];
  return payload?.events ?? [];
}

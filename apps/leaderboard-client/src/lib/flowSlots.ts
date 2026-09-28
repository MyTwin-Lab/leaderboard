import type { ComponentType, ReactNode } from 'react';
import type { HeroStat } from '@/components/challenges/HeroStats';
import type { BoardTask } from '@/components/contributor/ContributorTaskBoard';
import type { CodeParticipation, ProjectContribution } from '@/components/challenges/CodeChallengePanel';

/**
 * Slots d'interface des flows (challenge 020, L4)
 * -----------------------------------------------
 * Ce qu'un flow place dans les écrans du shell : les onglets du contributeur
 * et du manager, la mesure propre au flow dans le hero, la vue d'un visiteur
 * anonyme et la vue de ses règles. Les écrans ne branchent plus sur le type :
 * ils demandent les slots du flow (`@/distribution/mytwin.client`).
 *
 * Le libellé, le libellé long et l'icône du flow ne sont pas des slots : ils
 * sont dans son descripteur (`flowCatalog`, `FlowIcon`), lu aussi côté serveur.
 */

export interface FlowTab {
  label: string;
  panel: ReactNode;
}

export interface SlotTeamMember {
  id: string;
  fullName: string;
  githubUsername?: string;
  avatarUrl?: string;
}

/** Ce que les slots lisent d'un challenge. */
export interface SlotChallenge {
  uuid: string;
  type: string;
  status: string;
  contribution_points_reward: number;
  flow_config?: unknown;
  reward_rules?: unknown;
}

/** L'état du pool (`/api/challenges/[id]/rewards`) et les champs du flow ; un anonyme n'en reçoit qu'une partie. */
export interface ChallengeRewards {
  pool?: number;
  distributed?: number;
  remaining?: number;
  metric?: { name: string; baseline: number; points: number[] } | null;
  bestValue?: number | null;
  [field: string]: unknown;
}

// ─── Page contributeur ──────────────────────────────────────────────────────

/** Une tâche de l'overview : du template (sans `user_id`) ou du board d'un participant. */
export interface ContributorTask extends BoardTask {
  user_id?: string | null;
}

/** Une ligne de contribution de l'overview. */
export interface BoardContribution {
  uuid: string;
  task_id?: string;
  user_id: string;
  type?: string;
  evaluation?: { globalScore?: number } | null;
  evaluation_status?: string;
  reward: number;
  submitted_at: string;
}

export interface ContributorSlotContext {
  challengeId: string;
  challenge: SlotChallenge;
  team: SlotTeamMember[];
  tasks: ContributorTask[];
  participants: CodeParticipation[];
  contributions: BoardContribution[];
  repoActivity: Record<string, any> | null;
  /** `null` tant qu'il n'est pas chargé, ou pour un flow qui ne le lit pas. */
  rewards: ChallengeRewards | null;
  isMember: boolean;
  /** Le board sur lequel travaille le visiteur : le sien en solo, celui du porteur en groupe. */
  myTasks: ContributorTask[];
  templateTasks: ContributorTask[];
  myParticipation: CodeParticipation | null;
  myProjectContribution: ProjectContribution | null;
  reloadBoard: () => Promise<void>;
}

// ─── Vue manager ────────────────────────────────────────────────────────────

export interface ManageTask {
  uuid: string;
  title: string;
  description?: string;
  status: string;
  user_id?: string | null;
  parent_task_id?: string;
}

export interface ManageParticipant {
  user_id: string;
  workspace_provider?: string | null;
  workspace_ref?: string | null;
  workspace_url?: string | null;
  workspace_status?: string | null;
}

export interface ManageContribution {
  uuid: string;
  title: string;
  type: string;
  description?: string;
  reward: number;
  user_id: string;
  submitted_at: string;
  evaluation?: { globalScore?: number };
  evaluation_status?: 'running' | 'done' | 'failed';
}

export interface ManageSlotContext {
  challengeId: string;
  challenge: SlotChallenge;
  team: SlotTeamMember[];
  tasks: ManageTask[];
  participants: ManageParticipant[];
  contributions: ManageContribution[];
  repoActivity: Record<string, any> | null;
  rewards: ChallengeRewards | null;
  /** Scaleway est connecté : la puissance de calcul peut être demandée sur la plateforme. */
  computeConnected: boolean;
  /** Les onglets communs à tous les flows, rendus par l'écran ; chaque flow les place où il veut. */
  common: { overview: FlowTab; rankings: FlowTab };
}

// ─── Règles ─────────────────────────────────────────────────────────────────

export interface RulesChallenge {
  type: string;
  contribution_points_reward: number;
  reward_rules?: unknown;
  flow_config?: unknown;
}

// ─── Slots ──────────────────────────────────────────────────────────────────

export interface FlowUiSlots {
  /** Les écrans chargent `/api/challenges/[id]/rewards` : le flow a des règles de récompense qu'ils affichent. */
  readsRewards?: boolean;
  /** Une contribution se détaille ligne à ligne dans le ledger (plusieurs clés par contribution). */
  rewardBreakdown?: boolean;
  contributorTabs(ctx: ContributorSlotContext): FlowTab[];
  /** La mesure du milieu du hero, entre les CP distribués et l'équipe. */
  contributorHeroStat(ctx: ContributorSlotContext): HeroStat;
  /** Ce qu'un visiteur anonyme voit à la place des onglets. Sans slot : la progression des participants. */
  anonymousView?(ctx: ContributorSlotContext): ReactNode;
  manageTabs(ctx: ManageSlotContext): FlowTab[];
  manageHeroStat(ctx: ManageSlotContext): HeroStat;
  /** Le corps du tiroir des règles de récompense. */
  rulesView: ComponentType<{ challenge: RulesChallenge }>;
}

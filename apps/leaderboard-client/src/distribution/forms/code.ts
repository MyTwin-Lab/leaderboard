import {
  DEFAULT_CODE_REWARD_RULES,
  parseCodeRewardRules,
  type CodeRewardRules,
} from '../../../../../packages/database-service/domain/codeRewardRules';
import { codeFlowDescriptor } from '../../../../../content/flows/code/descriptor';
import { flushTemplateTasks } from '@/components/admin/templateTasksFlush';
import type { FlowFormLogic } from '@/lib/flowFormSlots';
import { flowConfigRecord } from './shared';

export type WorkspaceMode = 'provided_repo' | 'own_repo';

/** `id` est une clé locale (jamais envoyée) : retirer une ligne ne dépend pas de sa position. */
export interface PendingTask {
  id: string;
  title: string;
}

export interface CodeFormState {
  workspaceMode: WorkspaceMode;
  githubRepo: string;
  codeRules: CodeRewardRules;
  /** Tâches du template, bufferisées tant que le challenge n'existe pas (création et promotion). */
  pendingTasks: PendingTask[];
  pendingTaskTitle: string;
  nextTaskId: number;
}

/** Section du flow code : mode de workspace, règles, tâches du template, dépôt partagé. */
export const codeFormLogic: FlowFormLogic<CodeFormState> = {
  key: codeFlowDescriptor.key,
  covers: (flowKey) => flowKey === codeFlowDescriptor.key,

  initialState(ctx) {
    if (ctx.mode === 'edit') {
      return {
        workspaceMode: flowConfigRecord(ctx.challenge).workspace_mode === 'own_repo' ? 'own_repo' : 'provided_repo',
        githubRepo: '',
        codeRules: parseCodeRewardRules(ctx.challenge?.reward_rules) ?? DEFAULT_CODE_REWARD_RULES,
        pendingTasks: [],
        pendingTaskTitle: '',
        nextTaskId: 0,
      };
    }
    // Les buts d'une proposition sont le candidat naturel aux tâches du
    // challenge : ils arrivent en template tasks, éditables avant l'envoi.
    const goals = ctx.mode === 'promotion' ? ctx.promotion?.goals ?? [] : [];
    return {
      // Un sandbox code devient un challenge `own_repo` : l'auteur arrive avec
      // son dépôt, il n'y a pas de repo partagé à provisionner.
      workspaceMode: ctx.mode === 'promotion' ? 'own_repo' : 'provided_repo',
      githubRepo: '',
      codeRules: DEFAULT_CODE_REWARD_RULES,
      pendingTasks: goals.map((title, i) => ({ id: String(i), title })),
      pendingTaskTitle: '',
      nextTaskId: goals.length,
    };
  },

  body(state, ctx) {
    // Sans règles, un challenge code ne verse rien : le service n'a rien contre quoi scorer.
    const rules = { reward_rules: state.codeRules, compute_enabled: false };
    // L'édition ne touche ni le mode ni le repo, qui décident des repos créés ;
    // la promotion ne les envoie pas, ils découlent de la proposition.
    if (ctx.mode !== 'create') return rules;
    return {
      type: codeFlowDescriptor.key,
      ...rules,
      workspace_mode: state.workspaceMode,
      github_repo: state.workspaceMode === 'provided_repo' && state.githubRepo.trim() ? state.githubRepo.trim() : undefined,
    };
  },

  // Les tâches bufferisées partent une fois le challenge créé. Séquentiel et
  // non bloquant : le challenge est déjà enregistré.
  async afterSave(saved, state, ctx) {
    if (ctx.mode === 'edit' || state.pendingTasks.length === 0) return [];
    const { failed } = await flushTemplateTasks(saved.uuid, state.pendingTasks);
    return failed > 0 ? [`${failed} template task${failed > 1 ? 's' : ''} failed to save`] : [];
  },
};

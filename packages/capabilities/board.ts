import { TaskRepository } from "../database-service/repositories/index.js";
import { flowUses } from "./challenge-hooks.js";

/**
 * Capacité `board` — le kanban personnel
 * --------------------------------------
 * Un flow qui déclare `uses.board` donne à chaque participant (au porteur,
 * pour un groupe) un board copié du template du challenge à son arrivée. Le
 * flow lit ensuite l'avancement de ce board, sans connaître les tâches.
 */

export interface BoardDeps {
  taskRepo: Pick<TaskRepository, "findTemplateTasks" | "findPersonalTasks" | "create">;
}

export interface BoardProgress {
  total: number;
  done: number;
}

function withDefaults(deps?: Partial<BoardDeps>): BoardDeps {
  return { taskRepo: deps?.taskRepo ?? new TaskRepository() };
}

/** Le flow de ce type a des boards. */
export function usesBoard(type: string | null | undefined): boolean {
  return flowUses(type, "board");
}

/**
 * Copie le template du challenge sur le board de `userId` : les tâches mères
 * d'abord, pour rattacher chaque sous-tâche à la copie de sa mère. Renvoie le
 * nombre de tâches créées.
 */
export async function copyBoardTemplate(challengeId: string, userId: string, deps?: Partial<BoardDeps>): Promise<number> {
  const { taskRepo } = withDefaults(deps);
  const template = await taskRepo.findTemplateTasks(challengeId);
  const parents = template.filter((t) => !t.parent_task_id);
  const children = template.filter((t) => t.parent_task_id);

  const copies = new Map<string, string>();
  let created = 0;
  for (const t of parents) {
    const copy = await taskRepo.create({
      challenge_id: challengeId, user_id: userId,
      title: t.title, description: t.description, status: "todo",
    });
    copies.set(t.uuid, copy.uuid);
    created++;
  }
  for (const t of children) {
    await taskRepo.create({
      challenge_id: challengeId, user_id: userId,
      parent_task_id: copies.get(t.parent_task_id!) ?? undefined,
      title: t.title, description: t.description, status: "todo",
    });
    created++;
  }
  return created;
}

/** L'avancement du board de `ownerId`. */
export async function boardProgress(challengeId: string, ownerId: string, deps?: Partial<BoardDeps>): Promise<BoardProgress> {
  const { taskRepo } = withDefaults(deps);
  const tasks = await taskRepo.findPersonalTasks(challengeId, ownerId);
  return { total: tasks.length, done: tasks.filter((t) => t.status === "done").length };
}

/** Un board terminé : au moins une tâche, et toutes faites. */
export function isBoardDone(progress: BoardProgress): boolean {
  return progress.total > 0 && progress.done === progress.total;
}

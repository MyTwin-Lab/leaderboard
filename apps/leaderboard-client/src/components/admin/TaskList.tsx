'use client';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Task } from '../../../../../packages/database-service/domain/entities';

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, onEdit, onDelete }: TaskListProps) {
  // Séparer les tâches principales des sous-tâches
  const mainTasks = tasks.filter(t => !t.parent_task_id);
  const getSubTasks = (parentId: string) => tasks.filter(t => t.parent_task_id === parentId);

  if (tasks.length === 0) {
    return <div className="text-white/50 text-sm py-4">No tasks yet</div>;
  }

  return (
    <div className="space-y-2">
      {mainTasks.map((task) => (
        <div key={task.uuid}>
          {/* Tâche principale */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div>
                <div className="font-medium text-white">{task.title}</div>
                {task.description && (
                  <div className="text-xs text-white/50 mt-0.5">{task.description}</div>
                )}
              </div>
              <Badge label={task.type} />
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => onEdit(task)}>
                ✏️
              </Button>
              <Button size="sm" variant="danger" onClick={() => onDelete(task.uuid)}>
                🗑️
              </Button>
            </div>
          </div>

          {/* Sous-tâches */}
          {getSubTasks(task.uuid).map((subTask) => (
            <div
              key={subTask.uuid}
              className="flex items-center justify-between p-2 ml-6 mt-1 rounded-lg bg-white/3 border border-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="text-white/60 text-sm">↳</div>
                <div>
                  <div className="text-sm text-white">{subTask.title}</div>
                  {subTask.description && (
                    <div className="text-xs text-white/40">{subTask.description}</div>
                  )}
                </div>
                <Badge label={subTask.type} />
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => onEdit(subTask)}>
                  ✏️
                </Button>
                <Button size="sm" variant="danger" onClick={() => onDelete(subTask.uuid)}>
                  🗑️
                </Button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

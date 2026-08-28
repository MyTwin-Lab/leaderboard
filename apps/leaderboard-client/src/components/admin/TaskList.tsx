'use client';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pencil, Trash2 } from 'lucide-react';
import type { Task } from '../../../../../packages/database-service/domain/entities';

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, onEdit, onDelete }: TaskListProps) {
  const mainTasks = tasks.filter((t) => !t.parent_task_id);
  const getSubTasks = (parentId: string) => tasks.filter((t) => t.parent_task_id === parentId);

  if (tasks.length === 0) {
    return <p className="py-4 text-sm text-white/30 italic">No tasks yet</p>;
  }

  return (
    <div className="space-y-1.5">
      {mainTasks.map((task) => (
        <div key={task.uuid}>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="min-w-0">
                <div className="font-medium text-white text-sm truncate">{task.title}</div>
                {task.description && (
                  <div className="text-xs text-white/40 mt-0.5 truncate">{task.description}</div>
                )}
              </div>
              <Badge label={task.status} />
            </div>
            <div className="flex gap-1 shrink-0 ml-2">
              <Button size="sm" variant="ghost" onClick={() => onEdit(task)} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="danger" onClick={() => onDelete(task.uuid)} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {getSubTasks(task.uuid).map((sub) => (
            <div
              key={sub.uuid}
              className="ml-6 mt-1 flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-white/30 text-sm shrink-0">↳</span>
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{sub.title}</div>
                  {sub.description && (
                    <div className="text-xs text-white/40 truncate">{sub.description}</div>
                  )}
                </div>
                <Badge label={sub.status} />
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <Button size="sm" variant="ghost" onClick={() => onEdit(sub)} title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="danger" onClick={() => onDelete(sub.uuid)} title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

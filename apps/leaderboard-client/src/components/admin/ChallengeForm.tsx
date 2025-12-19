'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { TaskList } from './TaskList';
import { TaskForm } from './TaskForm';
import type { Challenge, Project, Task } from '../../../../../packages/database-service/domain/entities';

interface ChallengeFormProps {
  challenge?: Challenge;
  projects: Project[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function ChallengeForm({ challenge, projects, onSubmit, onCancel }: ChallengeFormProps) {
  const [formData, setFormData] = useState({
    title: challenge?.title || '',
    status: challenge?.status || 'draft',
    start_date: challenge?.start_date ? new Date(challenge.start_date).toISOString().split('T')[0] : '',
    end_date: challenge?.end_date ? new Date(challenge.end_date).toISOString().split('T')[0] : '',
    description: challenge?.description || '',
    roadmap: challenge?.roadmap || '',
    contribution_points_reward: challenge?.contribution_points_reward || 0,
    project_id: challenge?.project_id || '',
  });

  // Task management state (only for existing challenges)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();

  useEffect(() => {
    if (challenge?.uuid) {
      fetchTasks();
    }
  }, [challenge?.uuid]);

  const fetchTasks = async () => {
    if (!challenge?.uuid) return;
    try {
      const res = await fetch(`/api/tasks?challenge_id=${challenge.uuid}`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    }
  };

  const handleCreateTask = async (data: any) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchTasks();
        setShowTaskForm(false);
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleUpdateTask = async (data: any) => {
    if (!editingTask) return;
    try {
      const res = await fetch(`/api/tasks/${editingTask.uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchTasks();
        setShowTaskForm(false);
        setEditingTask(undefined);
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchTasks();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleCancelTaskForm = () => {
    setShowTaskForm(false);
    setEditingTask(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Title *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Status *
          </label>
          <select
            required
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Start Date *
          </label>
          <input
            type="date"
            required
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            End Date *
          </label>
          <input
            type="date"
            required
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            CP Reward *
          </label>
          <input
            type="number"
            required
            min="0"
            value={formData.contribution_points_reward}
            onChange={(e) => setFormData({ ...formData, contribution_points_reward: parseInt(e.target.value) })}
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Project *
          </label>
          <select
            required
            value={formData.project_id}
            onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.uuid} value={project.uuid}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white/80 mb-1.5">
          Description
        </label>
        <textarea
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {/* Tasks section - only shown when editing an existing challenge */}
      {challenge?.uuid && (
        <div className="border-t border-white/10 pt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-white/80">
              Tasks
            </label>
            {!showTaskForm && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowTaskForm(true)}
              >
                + Add Task
              </Button>
            )}
          </div>

          {showTaskForm ? (
            <TaskForm
              task={editingTask}
              challengeId={challenge.uuid}
              availableParentTasks={tasks.filter(t => !t.parent_task_id)}
              onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
              onCancel={handleCancelTaskForm}
            />
          ) : (
            <TaskList
              tasks={tasks}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
            />
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-white/80 mb-1.5">
          Roadmap
        </label>
        <textarea
          rows={4}
          value={formData.roadmap}
          onChange={(e) => setFormData({ ...formData, roadmap: e.target.value })}
          className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          {challenge ? 'Update' : 'Create'} Challenge
        </Button>
      </div>
    </form>
  );
}

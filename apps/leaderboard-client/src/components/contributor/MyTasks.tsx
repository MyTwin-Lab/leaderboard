'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { trackOnboardingStep } from '@/lib/onboarding-track';

interface TaskWithChallenge {
  uuid: string;
  title: string;
  description?: string;
  type: 'solo' | 'concurrent';
  status: 'todo' | 'done';
  challenge_id: string;
  challenge_title: string;
}

export function MyTasks() {
  const [tasks, setTasks] = useState<TaskWithChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showValidated, setShowValidated] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/contributors/me/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = (taskId: string) => {
    // Placeholder pour l'évaluation future
    console.log('Evaluate task:', taskId);
    trackOnboardingStep('evaluated_contribution');
  };

  if (loading) {
    return (
      <div className="rounded-lg bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">My Tasks</h2>
        <p className="text-white/40">Loading tasks...</p>
      </div>
    );
  }

  // Séparer les tâches par statut
  const todoTasks = tasks.filter(task => task.status === 'todo');
  const doneTasks = tasks.filter(task => task.status === 'done');

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowValidated(!showValidated)}
          className="text-sm text-brandCP hover:text-brandCP/80 transition-colors"
        >
          {showValidated ? 'Hide validated' : 'Show validated'}
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-white/40">No tasks assigned yet</p>
      ) : (
        <div className="space-y-3">
          {/* Tâches à faire */}
          {todoTasks.map((task) => (
            <Link
              key={task.uuid}
              href={`/tasks/${task.uuid}`}
              className="block rounded-lg bg-white/5 p-4 transition hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-medium text-white">{task.title}</h3>
                  <p className="text-sm text-white/70 mt-1">Challenge: {task.challenge_title}</p>
                  {task.description && (
                    <p className="text-sm text-white/50 mt-2 line-clamp-2">{task.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={task.type} />
                </div>
              </div>
            </Link>
          ))}

          {/* Tâches validées (uniquement si showValidated est true) */}
          {showValidated && doneTasks.map((task) => (
            <Link
              key={task.uuid}
              href={`/tasks/${task.uuid}`}
              className="block rounded-lg bg-green-500/10 border border-green-500/20 p-4 transition hover:bg-green-500/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-medium text-white">{task.title}</h3>
                  <p className="text-sm text-brandCP mt-1">{task.challenge_title}</p>
                  {task.description && (
                    <p className="text-sm text-white/50 mt-2 line-clamp-2">{task.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={task.type} />
                  <Badge label="Completed" variant="success" />
                </div>
              </div>
            </Link>
          ))}

          {/* Message si aucune tâche validée et showValidated est true */}
          {showValidated && doneTasks.length === 0 && todoTasks.length > 0 && (
            <p className="text-white/40 text-center py-4">No completed tasks yet</p>
          )}
        </div>
      )}
    </div>
  );
}

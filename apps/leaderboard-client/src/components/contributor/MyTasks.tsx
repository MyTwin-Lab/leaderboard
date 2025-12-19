'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';

interface TaskWithChallenge {
  uuid: string;
  title: string;
  description?: string;
  type: 'solo' | 'concurrent';
  challenge_id: string;
  challenge_title: string;
}

export function MyTasks() {
  const [tasks, setTasks] = useState<TaskWithChallenge[]>([]);
  const [loading, setLoading] = useState(true);

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
  };

  if (loading) {
    return (
      <div className="rounded-lg bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">My Tasks</h2>
        <p className="text-white/40">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg shadow-md bg-white/5 p-4">
      <h2 className="text-lg font-semibold text-white mb-4">My Tasks</h2>
      
      {tasks.length === 0 ? (
        <p className="text-white/40">No tasks assigned yet</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.uuid}
              className="rounded-lg bg-white/5 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-medium text-white">{task.title}</h3>
                  <p className="text-sm text-brandCP mt-1">{task.challenge_title}</p>
                  {task.description && (
                    <p className="text-sm text-white/50 mt-2">{task.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={task.type} />
                  <button
                    onClick={() => handleEvaluate(task.uuid)}
                    className="rounded-full bg-white/10 px-4 py-1.5 shadow-md text-sm font-medium text-white hover:bg-white/20 transition"
                  >
                    Evaluate
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

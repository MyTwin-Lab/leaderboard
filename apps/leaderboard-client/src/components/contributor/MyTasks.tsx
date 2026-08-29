'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { trackOnboardingStep } from '@/lib/onboarding-track';

interface TaskWithChallenge {
  uuid: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  challenge_id: string;
  challenge_title: string;
}

export function MyTasks() {
  const [tasks, setTasks] = useState<TaskWithChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/contributors/me/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
        trackOnboardingStep('evaluated_contribution');
      }
    } catch {}
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-2xl bg-white/5 border border-white/[0.06]" />
        ))}
      </div>
    );
  }

  const activeTasks = tasks.filter(t => t.status !== 'done');
  const doneTasks = tasks.filter(t => t.status === 'done');

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/6 bg-white/[0.02] py-14 text-center">
        <Circle className="h-7 w-7 text-white/15" />
        <p className="text-xs text-white/25">No tasks yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active tasks */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
            <Circle className="h-3.5 w-3.5 text-primary-100/35" />
            Active
          </h2>
          <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/40">
            {activeTasks.length}
          </span>
        </div>
        {activeTasks.length === 0 ? (
          <p className="py-4 text-center text-xs text-white/25">All caught up</p>
        ) : (
          activeTasks.map((task, idx) => {
            const inProgress = task.status === 'in_progress';
            return (
              <Link
                key={task.uuid}
                href={`/tasks/${task.uuid}`}
                className="group animate-slide-in-left flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.06] hover:translate-x-0.5"
                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
              >
                {/* Dot with ping while in progress */}
                <span className="relative flex h-2 w-2 shrink-0">
                  {inProgress && (
                    <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-50" />
                  )}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${inProgress ? 'bg-yellow-400' : 'bg-white/25'}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate group-hover:text-white transition-colors">
                    {task.title}
                  </p>
                  <p className="mt-0.5 text-xs text-white/30 truncate">{task.challenge_title}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  inProgress ? 'bg-yellow-500/15 text-yellow-400' : 'bg-white/8 text-white/40'
                }`}>
                  {inProgress ? 'In progress' : 'To do'}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/0 transition-all group-hover:text-white/25" />
              </Link>
            );
          })
        )}
      </div>

      {/* Done tasks */}
      {doneTasks.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary-100/35" />
              Done
            </h2>
            <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/40">
              {doneTasks.length}
            </span>
            <button
              onClick={() => setShowDone(v => !v)}
              className="text-[10px] text-white/25 hover:text-white/50 transition-colors"
            >
              {showDone ? 'hide' : 'show'}
            </button>
          </div>
          {showDone && doneTasks.map((task) => (
            <Link
              key={task.uuid}
              href={`/tasks/${task.uuid}`}
              className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.04]"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/35 line-through decoration-white/20 truncate">
                  {task.title}
                </p>
                <p className="mt-0.5 text-xs text-white/20 truncate">{task.challenge_title}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/0 transition-all group-hover:text-white/20" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

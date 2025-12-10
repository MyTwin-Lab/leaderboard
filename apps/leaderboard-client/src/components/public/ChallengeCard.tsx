'use client';

import { useState, useEffect } from "react";
import { ChallengeProgressBar } from "../ui/ChallengeProgressBar";
import { TeamAvatars } from "../ui/TeamAvatars";
import type { TeamMember } from "@/lib/types";

interface TaskWithAssignees {
  uuid: string;
  title: string;
  description?: string;
  type: 'solo' | 'concurrent';
  parent_task_id?: string;
  assignees: TeamMember[];
}

interface ChallengeCardProps {
  challengeId: string;
  challengeTitle: string;
  projectName: string;
  description: string | null;
  rewardPool: number;
  progression: number; // 0-100
  isMember?: boolean;
  teamMembers: TeamMember[];
  startDate: string;
  endDate: string;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function ChallengeCard({
  challengeId,
  challengeTitle,
  projectName,
  description,
  rewardPool,
  progression,
  isMember = false,
  teamMembers,
  startDate,
  endDate,
}: ChallengeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [joinState, setJoinState] = useState<'idle' | 'loading' | 'success' | 'error'>(
    isMember ? 'success' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskWithAssignees[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);

  // Charger les tâches quand la modale s'ouvre
  useEffect(() => {
    if (isExpanded) {
      fetchTasks();
    }
  }, [isExpanded]);

  const fetchTasks = async () => {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/tasks?challenge_id=${challengeId}`);
      if (res.ok) {
        const tasksData = await res.json();
        // Charger les assignés pour chaque tâche
        const tasksWithAssignees = await Promise.all(
          (Array.isArray(tasksData) ? tasksData : []).map(async (task: any) => {
            try {
              const assigneesRes = await fetch(`/api/tasks/${task.uuid}/assignees`);
              const assignees = assigneesRes.ok ? await assigneesRes.json() : [];
              return {
                ...task,
                assignees: Array.isArray(assignees) ? assignees.map((a: any) => ({
                  id: a.uuid,
                  fullName: a.full_name,
                })) : [],
              };
            } catch {
              return { ...task, assignees: [] };
            }
          })
        );
        setTasks(tasksWithAssignees);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleAssignTask = async (taskId: string) => {
    setAssigningTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/assign`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchTasks(); // Recharger les tâches
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to assign');
      }
    } catch (error) {
      alert('Network error');
    } finally {
      setAssigningTaskId(null);
    }
  };

  const handleJoin = async () => {
    if (joinState === 'loading' || joinState === 'success') return;

    setJoinState('loading');
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/challenges/${challengeId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        setJoinState('success');
      } else {
        const data = await res.json();
        if (res.status === 409) {
          // Already a member
          setJoinState('success');
        } else {
          setJoinState('error');
          setErrorMessage(data.error || 'Failed to join');
        }
      }
    } catch (error) {
      setJoinState('error');
      setErrorMessage('Network error');
    }
  };

  return (
    <div className="rounded-md bg-white/5 p-5 shadow-md shadow-black/20 hover:bg-white/10">
      {/* Header: Project name + CP */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{challengeTitle}</h3>
        <span className="text-sm font-semibold text-white">
          {rewardPool.toLocaleString()} <span className="text-brandCP">CP</span>
        </span>
      </div>

      {/* Challenge title with chevron */}
      <button
        //onClick={() => setIsExpanded(!isExpanded)}
        className="mt-1 flex w-full items-center justify-between text-left"
      >
        <p className="text-sm font-medium text-white/70">{projectName}</p>
        <svg
          className={`h-5 w-5 text-white/60 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.17l3.71-2.94a.75.75 0 111.04 1.08l-4.23 3.36a.75.75 0 01-.94 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {description && (
        <p className="text-sm text-white mt-2">{description}</p>
      )}

      <div className="w-full">
        <div style={{"flexDirection": "column", justifyItems: "center"}} className="mt-2 flex items-center gap-3">
          <span className="text-sm text-brandCP">{progression}%</span>
          <ChallengeProgressBar value={progression / 100} />
        </div>
      </div>

      {/* Expanded content: Description + Progression */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          <span className="text-xs text-white/70 whitespace-nowrap">
            from {formatDate(startDate)} to {formatDate(endDate)}
          </span>

          {/* Tasks section */}
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs text-white/50">Tasks</p>
            {tasksLoading ? (
              <p className="text-sm text-white/40">Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-white/40">No tasks available</p>
            ) : (
              <div className="space-y-2">
                {tasks.filter(t => !t.parent_task_id).map((task) => (
                  <div
                    key={task.uuid}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{task.title}</span>
                      {task.type === 'concurrent' && (
                        <span className="text-xs text-white/40">"concurrent"</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {task.assignees.length > 0 && (
                        <TeamAvatars members={task.assignees} maxDisplay={3} />
                      )}
                      {/* Afficher Assign si solo sans assigné, ou si concurrent */}
                      {(task.type === 'concurrent' || task.assignees.length === 0) && (
                        <button
                          onClick={() => handleAssignTask(task.uuid)}
                          disabled={assigningTaskId === task.uuid}
                          className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition disabled:opacity-50"
                        >
                          {assigningTaskId === task.uuid ? '...' : 'Assign'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team avatars + Join button */}
      <div className="mt-4 flex items-center justify-between">
        <TeamAvatars members={teamMembers} />

        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleJoin}
            disabled={joinState === 'loading' || joinState === 'success'}
            className={`hidden rounded-full bg-white/10 shadow-md shadow-black/20 px-5 py-2 text-sm font-medium transition ${
              joinState === 'success'
                ? 'bg-brandCP/20 text-brandCP cursor-default'
                : joinState === 'loading'
                ? 'text-white/50 cursor-wait'
                : 'text-white hover:text-brandCP hover:bg-brandCP/10 cursor-pointer'
            }`}
          >
            {joinState === 'loading' ? 'Joining...' : joinState === 'success' ? 'Joined' : 'Join'}
          </button>
          {errorMessage && (
            <span className="text-xs text-red-400">{errorMessage}</span>
          )}
        </div>
      </div>
    </div>
  );
}

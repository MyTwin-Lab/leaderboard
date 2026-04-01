'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  challengeIndex: number;
  challengeTitle: string;
  projectName: string;
  description: string | null;
  rewardPool: number;
  completion: number; // 0-100
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
  challengeIndex,
  challengeTitle,
  projectName,
  description,
  rewardPool,
  completion,
  isMember = false,
  teamMembers,
  startDate,
  endDate,
}: ChallengeCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [joinState, setJoinState] = useState<'idle' | 'loading' | 'success' | 'error'>(
    isMember ? 'success' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    <div 
      onClick={() => router.push(`/challenges/${challengeId}`)}
      className="rounded-md bg-white/5 p-4 shadow-md shadow-black/20 transition hover:bg-white/10 sm:p-5 cursor-pointer"
    >
      {/* Header: Project name + CP */}
      <div className="flex items-start justify-between gap-2 sm:items-center">
        <h3 className="text-base font-semibold text-white sm:text-lg">{challengeTitle}</h3>
        <span className="shrink-0 text-xs font-semibold text-white sm:text-sm">
          {rewardPool.toLocaleString()} <span className="text-brandCP">CP</span>
        </span>
      </div>

      {/* Challenge title with chevron */}
      <button
        className="flex w-full items-center justify-between text-left"
      >
        <p className="text-xs font-medium text-white/70 sm:text-sm">Challenge {challengeIndex} • Project: {projectName}</p>
      </button>

      {description && (
        <p className="mt-2 text-xs text-white sm:mt-3 sm:text-sm">{description}</p>
      )}

      <div className="mt-3 flex w-full items-center justify-center sm:mt-4">
        <div className="flex w-full flex-col items-center gap-1 sm:w-[80%]">
          {completion === 100 ? (
            <>
              <span className="flex items-center gap-1 text-xs font-medium text-brandCP sm:text-sm">
                Completed
              </span>
              <ChallengeProgressBar value={1} />
            </>
          ) : (
            <>
              <span className="text-xs text-brandCP sm:text-sm">{completion}%</span>
              <ChallengeProgressBar value={completion / 100} />
            </>
          )}
        </div>
      </div>

      {/* Team avatars + Join button */}
      {/* <div className="mt-4 flex items-center justify-between">
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
      </div> */}
    </div>
  );
}

'use client';

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectWithChallenges, TeamMember } from "@/lib/types";
import { ChallengeCard } from "@/components/public/ChallengeCard";
import { ChallengesFiltersBar } from "@/components/public/ChallengesFiltersBar";
import { CreateChallengeDrawer } from "@/components/admin/CreateChallengeDrawer";
import { ManagerRolePopup } from "@/components/challenges/ManagerRolePopup";
import { Plus } from "lucide-react";

interface ProjectChallengesExplorerProps {
  projects: ProjectWithChallenges[];
  joinedChallengeIds: string[];
  isAdmin?: boolean;
  managedProjectIds?: string[];
}

type StatusFilter = 'all' | 'active' | 'completed' | 'draft' | 'manage';

type FlatChallenge = {
  id: string;
  index: number;
  title: string;
  status: string;
  type: string;
  projectName: string;
  projectId: string;
  description: string | null;
  rewardPool: number;
  completion: number;
  teamMembers: TeamMember[];
  startDate: string;
  endDate: string;
};

export function ProjectChallengesExplorer({ projects, joinedChallengeIds, isAdmin = false, managedProjectIds = [] }: ProjectChallengesExplorerProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [managerDrawerOpen, setManagerDrawerOpen] = useState(false);
  const [popup, setPopup] = useState<{ x: number; y: number; challengeId: string } | null>(null);

  const joinedSet = useMemo(() => new Set(joinedChallengeIds), [joinedChallengeIds]);

  const allChallenges = useMemo<FlatChallenge[]>(() => {
    return projects
      .flatMap((project) =>
        project.challenges.map((challenge) => ({
          id: challenge.id,
          index: challenge.index,
          title: challenge.title,
          status: challenge.status,
          type: challenge.type,
          projectName: project.title,
          projectId: project.id,
          description: project.description,
          rewardPool: challenge.rewardPool,
          completion: Math.round(challenge.completion * 100),
          teamMembers: challenge.teamMembers,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
        }))
      )
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [projects]);

  const managedSet = useMemo(() => new Set(managedProjectIds), [managedProjectIds]);

  const managedProjectOptions = useMemo(
    () => projects.filter(p => managedSet.has(p.id)).map(p => ({ id: p.id, name: p.title })),
    [projects, managedSet],
  );

  const filteredChallenges = useMemo(() => {
    return allChallenges.filter((challenge) => {
      const matchesSearch =
        searchTerm === "" ||
        challenge.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        challenge.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProject =
        selectedProjectId === "all" || challenge.projectId === selectedProjectId;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "manage"
            ? managedSet.has(challenge.projectId)
            : challenge.status === statusFilter;
      return matchesSearch && matchesProject && matchesStatus;
    });
  }, [allChallenges, searchTerm, selectedProjectId, statusFilter, managedSet]);

  const projectOptions = useMemo(() => {
    return projects.map((p) => ({ id: p.id, name: p.title }));
  }, [projects]);

  return (
    <>
      <div className="space-y-4">
        <ChallengesFiltersBar
          projects={projectOptions}
          onSearchChange={setSearchTerm}
          onProjectChange={setSelectedProjectId}
          onStatusChange={setStatusFilter}
          isAdmin={isAdmin}
          hasManaged={managedProjectIds.length > 0}
          rightSlot={isAdmin ? (
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-brandCP/25 bg-brandCP/10 px-4 py-2.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/20 hover:shadow-[0_0_16px_rgba(10,247,193,0.15)]"
            >
              <Plus className="h-4 w-4" />
              New challenge
            </button>
          ) : statusFilter === 'manage' && managedProjectIds.length > 0 ? (
            <button
              onClick={() => setManagerDrawerOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-brandCP/25 bg-brandCP/10 px-4 py-2.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/20 hover:shadow-[0_0_16px_rgba(10,247,193,0.15)]"
            >
              <Plus className="h-4 w-4" />
              New challenge
            </button>
          ) : undefined}
        />

        {filteredChallenges.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center">
            <svg className="h-8 w-8 text-white/20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803M10.5 7.5v6m3-3h-6" />
            </svg>
            <p className="text-sm text-white/40">No challenge found.</p>
            {isAdmin && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-brandCP/20 bg-brandCP/10 px-5 py-2 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/20"
              >
                <Plus className="h-4 w-4" />
                Create the first challenge
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredChallenges.map((challenge, i) => (
              <ChallengeCard
                key={challenge.id}
                index={i}
                challengeId={challenge.id}
                challengeIndex={challenge.index}
                challengeTitle={challenge.title}
                challengeType={challenge.type}
                projectName={challenge.projectName}
                description={challenge.description}
                rewardPool={challenge.rewardPool}
                completion={challenge.completion}
                isMember={joinedSet.has(challenge.id)}
                isAdmin={isAdmin}
                teamMembers={challenge.teamMembers}
                startDate={challenge.startDate}
                endDate={challenge.endDate}
                onCardClick={managedSet.has(challenge.projectId)
                  ? (e) => setPopup({ x: e.clientX, y: e.clientY, challengeId: challenge.id })
                  : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Admin drawer */}
      {isAdmin && (
        <CreateChallengeDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          projects={projectOptions}
          onCreated={(id) => router.push(`/admin/challenges/${id}`)}
        />
      )}

      {/* Manager drawer */}
      {!isAdmin && managedProjectIds.length > 0 && (
        <CreateChallengeDrawer
          open={managerDrawerOpen}
          onClose={() => setManagerDrawerOpen(false)}
          projects={managedProjectOptions}
          onCreated={(id) => router.push(`/challenges/${id}/manage`)}
        />
      )}

      {/* Manager role popup */}
      {popup && (
        <ManagerRolePopup
          x={popup.x}
          y={popup.y}
          challengeId={popup.challengeId}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  );
}

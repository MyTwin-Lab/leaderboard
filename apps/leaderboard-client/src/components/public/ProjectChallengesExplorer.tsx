'use client';

import { useMemo, useState } from "react";
import type { ProjectWithChallenges, TeamMember } from "@/lib/types";
import { ChallengeCard } from "@/components/public/ChallengeCard";
import { ChallengesFiltersBar } from "@/components/public/ChallengesFiltersBar";

interface ProjectChallengesExplorerProps {
  projects: ProjectWithChallenges[];
  joinedChallengeIds: string[];
}

type FlatChallenge = {
  id: string;
  title: string;
  projectName: string;
  projectId: string;
  description: string | null;
  rewardPool: number;
  completion: number;
  teamMembers: TeamMember[];
  startDate: string;
  endDate: string;
};

export function ProjectChallengesExplorer({ projects, joinedChallengeIds }: ProjectChallengesExplorerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("all");

  const joinedSet = useMemo(() => new Set(joinedChallengeIds), [joinedChallengeIds]);

  // Flatten all challenges from all projects
  const allChallenges = useMemo<FlatChallenge[]>(() => {
    return projects.flatMap((project) =>
      project.challenges.map((challenge) => ({
        id: challenge.id,
        title: challenge.title,
        projectName: project.title,
        projectId: project.id,
        description: project.description, // Using project description for now
        rewardPool: challenge.rewardPool,
        completion: Math.round(challenge.completion * 100),
        teamMembers: challenge.teamMembers,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
      }))
    );
  }, [projects]);

  // Filter challenges based on search term and selected project
  const filteredChallenges = useMemo(() => {
    return allChallenges.filter((challenge) => {
      const matchesSearch =
        searchTerm === "" ||
        challenge.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        challenge.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProject =
        selectedProjectId === "all" || challenge.projectId === selectedProjectId;
      return matchesSearch && matchesProject;
    });
  }, [allChallenges, searchTerm, selectedProjectId]);

  // Build project list for the filter dropdown
  const projectOptions = useMemo(() => {
    return projects.map((p) => ({ id: p.id, name: p.title }));
  }, [projects]);

  return (
    <div className="space-y-1">
      <ChallengesFiltersBar
        projects={projectOptions}
        onSearchChange={setSearchTerm}
        onProjectChange={setSelectedProjectId}
      />

      {filteredChallenges.length === 0 ? (
        <p className="text-white/50">No challenge is currently available.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challengeId={challenge.id}
              challengeTitle={challenge.title}
              projectName={challenge.projectName}
              description={challenge.description}
              rewardPool={challenge.rewardPool}
              completion={challenge.completion}
              isMember={joinedSet.has(challenge.id)}
              teamMembers={challenge.teamMembers}
              startDate={challenge.startDate}
              endDate={challenge.endDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

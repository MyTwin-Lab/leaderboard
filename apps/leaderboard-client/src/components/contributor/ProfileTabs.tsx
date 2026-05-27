"use client";

import { useState } from "react";
import { ChallengeList } from "./ChallengeList";
import { DiscordSection } from "./DiscordSection";
import type { ContributorProfile } from "@/lib/types";
import type { DiscordEvaluationEntry } from "@/lib/server/leaderboard";

interface ProfileTabsProps {
  challenges: ContributorProfile["challenges"];
  discordEvaluations: DiscordEvaluationEntry[];
  isOwner: boolean;
  discordAccount: { discord_id: string; username: string } | null;
}

export function ProfileTabs({ challenges, discordEvaluations, isOwner, discordAccount }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<"challenges" | "discord">("challenges");

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg bg-white/5 p-1 sm:mb-5">
        <TabButton
          active={activeTab === "challenges"}
          onClick={() => setActiveTab("challenges")}
          label="Challenges"
          count={challenges.length}
        />
        <TabButton
          active={activeTab === "discord"}
          onClick={() => setActiveTab("discord")}
          label="Aide Discord"
          count={discordEvaluations.length}
        />
      </div>

      {activeTab === "challenges" && <ChallengeList challenges={challenges} />}
      {activeTab === "discord" && (
        <DiscordSection
          evaluations={discordEvaluations}
          isOwner={isOwner}
          discordAccount={discordAccount}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
        active
          ? "bg-white/10 text-white"
          : "text-white/50 hover:text-white/80"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          active ? "bg-brandCP/20 text-brandCP" : "bg-white/10 text-white/40"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCP } from "@/lib/formatters";
import { getMedalStyle } from "@/lib/medals";
import type { ContributorProfile } from "@/lib/types";

interface ContributionDashboardProps {
  challenges: ContributorProfile["challenges"];
}

const SEGMENT_COLORS = ["bg-brandCP", "bg-brandCP/55", "bg-brandCP/32", "bg-brandCP/18"];

export function ContributionDashboard({ challenges }: ContributionDashboardProps) {
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarsReady(true), 120);
    return () => clearTimeout(t);
  }, []);

  if (challenges.length === 0) return null;

  const totalCP = challenges.reduce((acc, c) => acc + c.reward, 0);
  const maxChallengeCP = Math.max(...challenges.map((c) => c.reward), 1);

  const topChallenges = [...challenges]
    .sort((a, b) => b.reward - a.reward)
    .slice(0, 4);

  const projectStats = challenges.reduce((acc, challenge) => {
    const project = challenge.projectName;
    if (!acc[project]) acc[project] = { count: 0, cp: 0 };
    acc[project].count += challenge.contributions.length;
    acc[project].cp += challenge.reward;
    return acc;
  }, {} as Record<string, { count: number; cp: number }>);

  const topProjects = Object.entries(projectStats)
    .sort((a, b) => b[1].cp - a[1].cp)
    .slice(0, 4)
    .map(([name, stats], i) => ({
      name,
      ...stats,
      pct: totalCP > 0 ? (stats.cp / totalCP) * 100 : 0,
      color: SEGMENT_COLORS[i] ?? SEGMENT_COLORS[SEGMENT_COLORS.length - 1],
    }));

  return (
    <div className="grid gap-5 sm:grid-cols-2 sm:items-start sm:gap-6">
      {/* Track record — biggest challenges */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Track record</span>
            <h2 className="text-lg font-semibold tracking-tight text-white">Biggest challenges</h2>
          </div>
          <Link
            href="?tab=contributions"
            className="text-xs font-semibold text-brandCP transition-colors hover:text-brandCP/80"
          >
            All contributions
          </Link>
        </div>

        <div className="space-y-2">
          {topChallenges.map((challenge, i) => {
            const rank = i + 1;
            const medal = getMedalStyle(rank);
            const pct = Math.round((challenge.reward / maxChallengeCP) * 100);
            return (
              <div
                key={challenge.id}
                className="animate-slide-in-left flex min-w-0 items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 transition-colors duration-150 hover:border-white/12"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
              >
                <span
                  className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${medal.badge}`}
                >
                  {rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{challenge.title}</p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brandCP/55 to-brandCP transition-[width] duration-700 ease-out"
                      style={{ width: barsReady ? `${pct}%` : "0%" }}
                    />
                  </div>
                  <p className="mt-1 truncate text-[11px] text-white/30">{challenge.projectName}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-brandCP">
                  {formatCP(challenge.reward)} CP
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Where the CP comes from */}
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
          Where the CP comes from
        </span>

        <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
          {topProjects.map((project) => (
            <div
              key={project.name}
              className={`h-full transition-[width] duration-700 ease-out ${project.color}`}
              style={{ width: barsReady ? `${project.pct}%` : "0%" }}
              title={`${project.name} — ${formatCP(project.cp)} CP`}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          {topProjects.map((project, i) => (
            <div
              key={project.name}
              className="animate-fade-up flex items-center gap-2.5"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${project.color}`} />
              <span className="min-w-0 flex-1 truncate text-sm text-white">{project.name}</span>
              <span className="shrink-0 text-[11px] text-white/30">
                {project.count} contribution{project.count !== 1 ? "s" : ""}
              </span>
              <span className="shrink-0 text-sm font-semibold text-white">{formatCP(project.cp)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

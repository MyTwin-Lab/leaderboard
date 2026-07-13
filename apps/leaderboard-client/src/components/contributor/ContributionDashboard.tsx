"use client";

import { useState, useEffect } from "react";
import { formatCP } from "@/lib/formatters";
import type { ContributorProfile } from "@/lib/types";
import { Award, Layers } from "lucide-react";

interface ContributionDashboardProps {
  challenges: ContributorProfile["challenges"];
}

export function ContributionDashboard({ challenges }: ContributionDashboardProps) {
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarsReady(true), 120);
    return () => clearTimeout(t);
  }, []);

  const totalCP = challenges.reduce((acc, c) => acc + c.reward, 0);

  const topChallenges = [...challenges]
    .sort((a, b) => b.reward - a.reward)
    .slice(0, 5);

  const projectStats = challenges.reduce((acc, challenge) => {
    const project = challenge.projectName;
    if (!acc[project]) acc[project] = { count: 0, cp: 0 };
    acc[project].count += challenge.contributions.length;
    acc[project].cp += challenge.reward;
    return acc;
  }, {} as Record<string, { count: number; cp: number }>);

  const topProjects = Object.entries(projectStats)
    .sort((a, b) => b[1].cp - a[1].cp)
    .slice(0, 4);

  if (challenges.length === 0) return null;

  return (
    <div className="grid gap-6 sm:grid-cols-2">

      {/* Top Challenges */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
          <Award className="h-3.5 w-3.5 text-primary-100/35" />
          Top Challenges
        </h2>
        <div className="space-y-1">
          {topChallenges.map((challenge, i) => (
            <div
              key={challenge.id}
              className="animate-slide-in-left flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 transition-colors duration-150 hover:border-white/10 hover:bg-white/[0.04]"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
            >
              <span className="w-4 shrink-0 text-[10px] font-bold tabular-nums text-white/20">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{challenge.title}</p>
                <p className="text-[10px] text-white/30 truncate">{challenge.projectName}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-brandCP">
                {formatCP(challenge.reward)} CP
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Projects */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
          <Layers className="h-3.5 w-3.5 text-primary-100/35" />
          Projects
        </h2>
        <div className="space-y-4">
          {topProjects.map(([project, stats], i) => {
            const pct = totalCP > 0 ? (stats.cp / totalCP) * 100 : 0;
            return (
              <div
                key={project}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white truncate">{project}</p>
                  <span className="shrink-0 animate-count-in text-xs font-semibold text-brandCP"
                    style={{ animationDelay: `${120 + i * 80}ms`, animationFillMode: 'both' }}>
                    {formatCP(stats.cp)} CP
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brandCP/60 to-brandCP transition-[width] duration-700 ease-out"
                    style={{ width: barsReady ? `${pct}%` : '0%' }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-primary-100/30">
                  {stats.count} contribution{stats.count !== 1 ? 's' : ''} · {pct.toFixed(0)}%
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

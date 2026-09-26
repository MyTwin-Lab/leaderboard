"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCP } from "@/lib/formatters";
import type { ContributorProfile } from "@/lib/types";

interface ContributionDashboardProps {
  challenges: ContributorProfile["challenges"];
}

/** L'accent, puis trois dilutions : la maquette n'emploie qu'une teinte. */
const SEGMENT_COLORS = [
  "var(--v-accent)",
  "color-mix(in srgb, var(--v-accent) 55%, transparent)",
  "color-mix(in srgb, var(--v-accent) 32%, transparent)",
  "color-mix(in srgb, var(--v-accent) 18%, transparent)",
];

/**
 * Le tableau de bord de l'onglet Overview, d'après `Profile Vitrine.dc.html`.
 *
 * Trois challenges, pas plus : au-delà, la liste devient un tableau qu'on ne
 * lit plus — et l'onglet Contributions les porte tous. La part du pool est dite
 * deux fois, en mots et par le filet en pied de carte.
 *
 * Les barres partent de zéro après le montage : c'est le seul mouvement de la
 * maquette ici, et il dit dans quel sens lire la carte.
 */
export function ContributionDashboard({ challenges }: ContributionDashboardProps) {
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarsReady(true), 120);
    return () => clearTimeout(t);
  }, []);

  if (challenges.length === 0) return null;

  const totalCP = challenges.reduce((acc, c) => acc + c.reward, 0);

  const topChallenges = [...challenges]
    .sort((a, b) => b.reward - a.reward)
    .slice(0, 3);

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
    <div className="v-pro-cols">
      <div className="v-pro-col-main">
        <div className="v-pro-head">
          <div className="v-pro-head-text">
            <span className="v-pro-kicker">Track record</span>
            <h2 className="v-pro-h2">Biggest challenges</h2>
          </div>
          <Link href="?tab=contributions" className="v-pro-link">
            All contributions
          </Link>
        </div>

        {topChallenges.map((challenge) => {
          const share = Math.round(challenge.contributionShare * 100);
          return (
            <div key={challenge.id} className="v-pro-big">
              <div className="v-pro-big-top">
                <span className="v-pro-big-title">{challenge.title}</span>
                <span className="v-pro-big-cp">
                  <span className="v-pro-big-cp-value">{formatCP(challenge.reward)}</span>
                  <span className="v-pro-big-cp-unit">CP</span>
                </span>
              </div>
              <div className="v-pro-big-meta">
                <span className="v-pro-tag">{challenge.projectName}</span>
                <span className="v-pro-share">{share}% of the pool</span>
              </div>
              <div className="v-pro-bar">
                <div className="v-pro-bar-fill" style={{ width: barsReady ? `${share}%` : "0%" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="v-pro-col-side">
        <div className="v-pro-night">
          <span className="v-pro-kicker">Where the CP comes from</span>

          <div className="v-pro-split">
            {topProjects.map((project) => (
              <div
                key={project.name}
                className="v-pro-split-seg"
                style={{ width: barsReady ? `${project.pct}%` : "0%", background: project.color }}
                title={`${project.name} - ${formatCP(project.cp)} CP`}
              />
            ))}
          </div>

          <div className="v-pro-projects">
            {topProjects.map((project) => (
              <div key={project.name} className="v-pro-proj">
                <span className="v-pro-proj-dot" style={{ background: project.color }} />
                <span className="v-pro-proj-name">{project.name}</span>
                <span className="v-pro-proj-count">
                  {project.count} contribution{project.count !== 1 ? "s" : ""}
                </span>
                <span className="v-pro-proj-cp">{formatCP(project.cp)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

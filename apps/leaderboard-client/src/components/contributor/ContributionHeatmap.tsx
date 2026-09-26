"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { formatCP } from "@/lib/formatters";
import type { ContributorProfile } from "@/lib/types";

interface ContributionHeatmapProps {
  challenges: ContributorProfile["challenges"];
}

interface DayData {
  date: Date;
  count: number;
  cp: number;
  contributions: Array<{
    title: string;
    reward: number;
    challengeTitle: string;
  }>;
}

/** Les cinq niveaux de la maquette, du vide à l'accent plein. */
function level(count: number) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

const LEGEND_LEVELS = [0, 1, 2, 3, 4];

function buildHeatmapData(challenges: ContributionHeatmapProps["challenges"]): DayData[] {
  const days: DayData[] = [];
  const today = new Date();
  const weeksAgo = new Date(today);
  weeksAgo.setDate(weeksAgo.getDate() - 52 * 7);

  for (let d = new Date(weeksAgo); d <= today; d.setDate(d.getDate() + 1)) {
    days.push({ date: new Date(d), count: 0, cp: 0, contributions: [] });
  }

  const dayByDate = new Map(days.map(d => [d.date.toISOString().slice(0, 10), d]));

  challenges.forEach((challenge) => {
    challenge.contributions.forEach((contribution) => {
      if (!contribution.submittedAt) return;
      const key = contribution.submittedAt.slice(0, 10);
      const day = dayByDate.get(key);
      if (!day) return; // outside the 52-week window
      day.count++;
      day.cp += contribution.reward;
      day.contributions.push({
        title: contribution.title,
        reward: contribution.reward,
        challengeTitle: challenge.title,
      });
    });
  });

  return days;
}

/**
 * Les chiffres que la maquette range à droite du calendrier. Elle en donne
 * quatre ; deux suffisent — la régularité et le mois écoulé. Le total de
 * l'année et le jour le plus chargé disaient la même grille autrement.
 */
function buildStats(days: DayData[]) {
  let last30 = 0;
  let streak = 0;
  let bestStreak = 0;

  const cutoff = Date.now() - 30 * 86400000;

  for (const day of days) {
    if (day.date.getTime() >= cutoff) last30 += day.count;
    if (day.count > 0) {
      streak += 1;
      if (streak > bestStreak) bestStreak = streak;
    } else {
      streak = 0;
    }
  }

  return [
    { value: `${bestStreak} day${bestStreak === 1 ? "" : "s"}`, label: "longest streak" },
    { value: String(last30), label: "in the last 30 days" },
  ];
}

/**
 * Le calendrier de contribution, d'après `Profile Vitrine.dc.html`.
 *
 * Les semaines sont alignées à droite dans une fenêtre qui s'efface à gauche :
 * la semaine courante est toujours visible, et la largeur de l'écran décide
 * combien d'histoire on voit — sans barre de défilement. Sur téléphone la
 * fenêtre se défile au doigt et les chiffres de droite s'effacent
 * (`profile-vitrine.css`) : à 390px, ils ne tiendraient pas à côté.
 */
export function ContributionHeatmap({ challenges }: ContributionHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [heatmapData] = useState<DayData[]>(() => buildHeatmapData(challenges));
  const [stats] = useState(() => buildStats(heatmapData));

  const weeks: DayData[][] = [];
  let currentWeek: DayData[] = [];

  // Group by weeks (7 days)
  heatmapData.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === heatmapData.length - 1) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });

  const tooltipEl = hoveredDay && hoveredDay.count > 0 && tooltipPosition
    ? createPortal(
        <div
          className="v-pro-tip"
          style={{
            top: `${tooltipPosition.y + 16}px`,
            left: tooltipPosition.x + 12 + 256 > window.innerWidth
              ? `${tooltipPosition.x - 268}px`
              : `${tooltipPosition.x + 12}px`,
          }}
        >
          <span className="v-pro-tip-date">
            {hoveredDay.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <div className="v-pro-tip-list">
            {hoveredDay.contributions.map((contribution, index) => (
              <div key={index} className="v-pro-tip-item">
                <span className="v-pro-tip-title">{contribution.title}</span>
                <span className="v-pro-tip-sub">{contribution.challengeTitle}</span>
                <span className="v-pro-tip-cp">+{formatCP(contribution.reward)} CP</span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="v-pro-card">
      {tooltipEl}
      <div className="v-pro-card-head">
        <h2 className="v-pro-kicker">Contribution activity</h2>
        <div className="v-pro-legend">
          <span>Less</span>
          {LEGEND_LEVELS.map((l) => (
            <span key={l} className="v-pro-legend-cell v-pro-day" data-level={l} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="v-pro-heat">
        <div className="v-pro-heat-window">
          <div className="v-pro-heat-weeks">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="v-pro-week">
                {week.map((day, dayIndex) => (
                  <span
                    key={`${weekIndex}-${dayIndex}`}
                    className="v-pro-day"
                    data-level={level(day.count)}
                    data-on={day.count > 0}
                    title={`${day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${day.count}`}
                    onMouseEnter={(e) => {
                      if (day.count > 0) {
                        setHoveredDay(day);
                        setTooltipPosition({ x: e.clientX, y: e.clientY });
                      }
                    }}
                    onMouseMove={(e) => {
                      if (day.count > 0) setTooltipPosition({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => {
                      setHoveredDay(null);
                      setTooltipPosition(null);
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <dl className="v-pro-activity">
          {stats.map((stat) => (
            <div key={stat.label} className="v-pro-activity-item">
              <dd className="v-pro-activity-value">{stat.value}</dd>
              <dt className="v-pro-activity-label">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

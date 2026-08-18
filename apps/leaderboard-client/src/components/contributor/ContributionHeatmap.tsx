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

interface MonthRun {
  label: string;
  span: number;
}

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

/** Month label per week column, run-length-encoded so a month spanning
 * several columns only prints its name once (over its first column). */
function buildMonthRuns(weeks: DayData[][]): MonthRun[] {
  const runs: MonthRun[] = [];
  for (const week of weeks) {
    const anchor = week[week.length - 1] ?? week[0];
    if (!anchor) continue;
    const month = anchor.date.toLocaleDateString("en-US", { month: "short" });
    const last = runs[runs.length - 1];
    if (last && last.label === month) last.span += 1;
    else runs.push({ label: month, span: 1 });
  }
  return runs;
}

/** Sparse weekday labels (Mon/Wed/Fri) — every column shares the same
 * row→weekday mapping since week chunks are contiguous 7-day runs. */
function buildWeekdayLabels(firstWeek: DayData[] | undefined): string[] {
  if (!firstWeek) return [];
  return firstWeek.map((day) => {
    const wd = day.date.toLocaleDateString("en-US", { weekday: "short" });
    return wd === "Mon" || wd === "Wed" || wd === "Fri" ? wd : "";
  });
}

export function ContributionHeatmap({ challenges }: ContributionHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [heatmapData] = useState<DayData[]>(() => buildHeatmapData(challenges));

  const getIntensityColor = (count: number) => {
    if (count === 0) return "bg-white/5";
    if (count === 1) return "bg-brandCP/30";
    if (count === 2) return "bg-brandCP/50";
    if (count <= 4) return "bg-brandCP/70";
    return "bg-brandCP";
  };

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

  const monthRuns = buildMonthRuns(weeks);
  const weekdayLabels = buildWeekdayLabels(weeks[0]);

  const tooltipEl = hoveredDay && hoveredDay.count > 0 && tooltipPosition
    ? createPortal(
        <div
          className="fixed z-[9999] w-64 pointer-events-none animate-slide-in"
          style={{
            top: `${tooltipPosition.y + 16}px`,
            left: tooltipPosition.x + 12 + 256 > window.innerWidth
              ? `${tooltipPosition.x - 268}px`
              : `${tooltipPosition.x + 12}px`,
          }}
        >
          <div className="rounded-2xl border border-white/10 p-3 shadow-xl" style={{ background: "var(--background-dark)" }}>
            <div className="mb-2">
              <span className="text-xs font-semibold text-white">
                {hoveredDay.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {hoveredDay.contributions.map((contribution, index) => (
                <div key={index} className="text-xs">
                  <p className="text-white font-medium truncate">{contribution.title}</p>
                  <p className="text-white/50 truncate">{contribution.challengeTitle}</p>
                  <p className="text-brandCP text-[10px]">+{formatCP(contribution.reward)} CP</p>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="animate-fade-up rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      {tooltipEl}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
          Contribution Activity
        </h2>
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span>Less</span>
          <div className="flex gap-1">
            {["bg-white/5","bg-brandCP/30","bg-brandCP/50","bg-brandCP/70","bg-brandCP"].map((cls, i) => (
              <div key={i} className={`h-3 w-3 rounded-sm ${cls}`} />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>

      <div className="relative mt-4 overflow-x-auto pb-1">
        <div className="flex min-w-max flex-col gap-1.5">
          {/* Month labels, offset to line up with the week columns below */}
          <div className="flex gap-1 pl-[26px]">
            {monthRuns.map((run, i) => (
              <span
                key={i}
                className="shrink-0 text-[10px] text-white/30"
                style={{ width: `${run.span * 16 - 4}px` }}
              >
                {run.span > 1 ? run.label : ""}
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            {/* Weekday labels */}
            <div className="flex w-[22px] shrink-0 flex-col gap-1">
              {weekdayLabels.map((label, i) => (
                <span key={i} className="h-3 text-[9px] leading-3 text-white/30">
                  {label}
                </span>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="flex gap-1">
              {weeks.map((week, weekIndex) => (
                <div
                  key={weekIndex}
                  className="flex flex-col gap-1 animate-fade-up"
                  style={{ animationDelay: `${weekIndex * 8}ms`, animationFillMode: 'both' }}
                >
                  {week.map((day, dayIndex) => (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
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
                    >
                      <div
                        className={`h-3 w-3 rounded-sm transition-all duration-150 cursor-default
                          ${day.count > 0 ? 'hover:scale-[1.4] hover:brightness-125 cursor-pointer' : ''}
                          ${hoveredDay === day ? 'scale-[1.4] brightness-125' : ''}
                          ${getIntensityColor(day.count)}`}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Shared rank → medal styling. Mirrors the gold/silver/bronze language
 * established by LeaderboardPodium so a #1/#2/#3 badge looks the same
 * everywhere it appears (podium, contributor header, top-challenges list).
 */
export interface MedalStyle {
  badge: string;
  label: string;
}

const MEDALS: Record<number, MedalStyle> = {
  1: {
    badge: "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-md shadow-yellow-500/40",
    label: "#1",
  },
  2: {
    badge: "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900 shadow-md shadow-slate-400/30",
    label: "#2",
  },
  3: {
    badge: "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100 shadow-md shadow-amber-600/30",
    label: "#3",
  },
};

const DEFAULT_MEDAL: MedalStyle = {
  badge: "bg-white/10 text-white/50",
  label: "",
};

export function getMedalStyle(rank: number): MedalStyle {
  return MEDALS[rank] ?? { ...DEFAULT_MEDAL, label: `#${rank}` };
}

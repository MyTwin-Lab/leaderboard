export type ThemeKey =
  | "default"
  | "purple-dark"
  | "teal-dark"
  | "blue-light"
  | "rose-light"
  | "sage-light";

export interface ThemeTokens {
  label: string;
  mode: "dark" | "light";
  primary100: string;
  primary200: string;
  primary300: string;
  brandCP: string;
  background: string;
  backgroundDark: string;
}

export const THEMES: Record<ThemeKey, ThemeTokens> = {
  // ── Dark themes ──────────────────────────────────────────
  "default": {
    label: "Blue",
    mode: "dark",
    primary100: "#8ad0ff",
    primary200: "#52c1ff",
    primary300: "#1ba5ff",
    brandCP: "#0af7c1",
    background: "#0a0a0a",
    backgroundDark: "#030208",
  },
  "purple-dark": {
    label: "Purple",
    mode: "dark",
    primary100: "#d8b4fe",
    primary200: "#c084fc",
    primary300: "#a855f7",
    brandCP: "#f472b6",
    background: "#13082a",
    backgroundDark: "#0c0418",
  },
  "teal-dark": {
    label: "Teal",
    mode: "dark",
    primary100: "#99f6e4",
    primary200: "#5eead4",
    primary300: "#14b8a6",
    brandCP: "#22d3ee",
    background: "#051c1a",
    backgroundDark: "#020e0d",
  },
  // ── Light themes ─────────────────────────────────────────
  "blue-light": {
    label: "Sky",
    mode: "light",
    primary100: "#bfdbfe",
    primary200: "#60a5fa",
    primary300: "#2563eb",
    brandCP: "#0891b2",
    background: "#f8fafc",
    backgroundDark: "#f1f5f9",
  },
  "rose-light": {
    label: "Rose",
    mode: "light",
    primary100: "#fecdd3",
    primary200: "#fb7185",
    primary300: "#e11d48",
    brandCP: "#db2777",
    background: "#fff1f2",
    backgroundDark: "#ffe4e6",
  },
  "sage-light": {
    label: "Sage",
    mode: "light",
    primary100: "#bbf7d0",
    primary200: "#4ade80",
    primary300: "#16a34a",
    brandCP: "#0d9488",
    background: "#f0fdf4",
    backgroundDark: "#dcfce7",
  },
};

export const DEFAULT_THEME_KEY: ThemeKey = "default";

export function isValidThemeKey(key: string): key is ThemeKey {
  return key in THEMES;
}

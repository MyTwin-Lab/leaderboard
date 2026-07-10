export type ThemeKey =
  | "default"
  | "purple-dark"
  | "green-dark"
  | "orange-dark"
  | "red-dark"
  | "teal-dark";

export interface ThemeTokens {
  label: string;
  primary100: string;
  primary200: string;
  primary300: string;
  brandCP: string;
  background: string;
  backgroundDark: string;
}

export const THEMES: Record<ThemeKey, ThemeTokens> = {
  "default": {
    label: "Blue",
    primary100: "#8ad0ff",
    primary200: "#52c1ff",
    primary300: "#1ba5ff",
    brandCP: "#0af7c1",
    background: "#0a0a0a",
    backgroundDark: "#030208",
  },
  "purple-dark": {
    label: "Purple",
    primary100: "#d8b4fe",
    primary200: "#c084fc",
    primary300: "#a855f7",
    brandCP: "#f472b6",
    background: "#09060f",
    backgroundDark: "#04020a",
  },
  "green-dark": {
    label: "Green",
    primary100: "#86efac",
    primary200: "#4ade80",
    primary300: "#22c55e",
    brandCP: "#84cc16",
    background: "#060a06",
    backgroundDark: "#020502",
  },
  "orange-dark": {
    label: "Orange",
    primary100: "#fdba74",
    primary200: "#fb923c",
    primary300: "#f97316",
    brandCP: "#fbbf24",
    background: "#0a0700",
    backgroundDark: "#050300",
  },
  "red-dark": {
    label: "Red",
    primary100: "#fca5a5",
    primary200: "#f87171",
    primary300: "#ef4444",
    brandCP: "#fb7185",
    background: "#0a0606",
    backgroundDark: "#050202",
  },
  "teal-dark": {
    label: "Teal",
    primary100: "#99f6e4",
    primary200: "#5eead4",
    primary300: "#14b8a6",
    brandCP: "#22d3ee",
    background: "#040a0a",
    backgroundDark: "#010505",
  },
};

export const DEFAULT_THEME_KEY: ThemeKey = "default";

export function isValidThemeKey(key: string): key is ThemeKey {
  return key in THEMES;
}

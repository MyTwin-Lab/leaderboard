import type { ThemeConfig } from "./types";
import { theme as defaultTheme } from "../../themes/default/config";

export function resolveTheme(themeName = process.env.NEXT_PUBLIC_THEME ?? "default"): ThemeConfig {
  if (themeName === "default") return defaultTheme;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require(`../../themes/${themeName}/config`) as { theme: ThemeConfig }).theme;
  } catch {
    return defaultTheme;
  }
}

export const theme = resolveTheme();

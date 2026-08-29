/** Parse a "#rrggbb" hex string to [r, g, b] 0-255 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Mix a color with white by `amount` (0 = original, 1 = white) */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

/** Mix a color with black by `amount` (0 = original, 1 = black) */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const nr = Math.round(r * (1 - amount));
  const ng = Math.round(g * (1 - amount));
  const nb = Math.round(b * (1 - amount));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

export interface ResolvedTheme {
  primary100: string;
  primary200: string;
  primary300: string;
  brandCP: string;
  background: string;
  backgroundDark: string;
  foreground: string;
}

/**
 * Build the full set of CSS tokens from the stored settings.
 * `primaryColor` and `backgroundColor` are custom hex overrides;
 * falls back to `paletteTokens` when null.
 */
export function resolveTheme(opts: {
  primaryColor: string | null | undefined;
  backgroundColor: string | null | undefined;
  themeMode: string;
  paletteTokens: { primary100: string; primary200: string; primary300: string; brandCP: string; background: string; backgroundDark: string };
}): ResolvedTheme {
  const { primaryColor, backgroundColor, themeMode, paletteTokens } = opts;

  let primary300: string;
  let primary200: string;
  let primary100: string;
  let brandCP: string;

  if (primaryColor) {
    primary300 = primaryColor;
    primary200 = lighten(primaryColor, 0.25);
    primary100 = lighten(primaryColor, 0.5);
    brandCP = primaryColor;
  } else {
    primary300 = paletteTokens.primary300;
    primary200 = paletteTokens.primary200;
    primary100 = paletteTokens.primary100;
    brandCP = paletteTokens.brandCP;
  }

  const background = backgroundColor ?? paletteTokens.background;
  const backgroundDark = backgroundColor
    ? darken(backgroundColor, 0.25)
    : paletteTokens.backgroundDark;

  const foreground = themeMode === "light" ? "#111111" : "#ededed";

  return { primary100, primary200, primary300, brandCP, background, backgroundDark, foreground };
}

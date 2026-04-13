import { describe, it, expect } from "vitest";
import { resolveTheme } from "./index";
import { theme as defaultTheme } from "../../themes/default/config";

describe("resolveTheme", () => {
  it("retourne le thème default quand aucune variable d'env n'est définie", () => {
    const result = resolveTheme("default");
    expect(result).toBe(defaultTheme);
  });

  it("retourne le thème default quand le thème demandé n'existe pas", () => {
    const result = resolveTheme("nonexistent-theme-xyz");
    expect(result).toBe(defaultTheme);
  });

  it("le thème par défaut a toutes les propriétés requises", () => {
    const result = resolveTheme("default");
    expect(result.appName).toBeDefined();
    expect(result.logoPath).toBeDefined();
    expect(result.colors.brandCP).toBeDefined();
    expect(result.colors.gradientFrom).toBeDefined();
    expect(result.nav.about).toBeDefined();
    expect(result.nav.leaderboard).toBeDefined();
    expect(result.nav.challenges).toBeDefined();
  });
});

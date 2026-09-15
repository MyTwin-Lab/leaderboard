import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Test d'architecture — les frontières du challenge 020
 * ------------------------------------------------------
 * Parcourt les imports du dépôt et vérifie qui a le droit d'importer qui :
 *
 * - le **core** (`packages/*` triés) n'importe ni contenu, ni module, ni la
 *   distribution, ni le shell, ni le code pas encore trié ;
 * - un élément de **contenu** (`content/<genre>/<nom>`) n'importe que
 *   lui-même, un kit (`content/kits/*`), le core ou le code pas encore trié —
 *   jamais un autre flow, connecteur ou provider, ni le shell ;
 * - un **module** (`modules/<nom>`) n'importe ni contenu, ni shell, ni un autre
 *   module ;
 * - le **shell** (l'app hors `src/distribution`) n'atteint le contenu et les
 *   modules qu'à travers la distribution ;
 * - le code **pas encore trié** n'importe ni contenu, ni module, ni shell.
 *
 * Les fichiers de test ne sont pas contrôlés : un test peut monter ce qu'il
 * vérifie. Une violation connue et acceptée se note dans `KNOWN_VIOLATIONS`,
 * qui ne peut que rétrécir : une entrée qui ne correspond plus à rien fait
 * échouer le test.
 */

const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const APP_SRC = path.join(ROOT, "apps/leaderboard-client/src");

/** Code qui n'a pas encore rejoint sa catégorie ; la liste rétrécit lot après lot. */
const UNSORTED_PREFIXES = [
  "packages/services/",
  "packages/slack-signal-agent/",
  "packages/sync-meeting-agent/",
  "packages/scaleway/",
  "packages/provisioner/src/providers/",
];

/** `fichier -> cible`, en chemins relatifs à la racine. */
const KNOWN_VIOLATIONS: string[] = [];

type Category = "core" | "content" | "module" | "distribution" | "shell" | "unsorted";

interface Location {
  category: Category;
  /** Le propriétaire dans sa catégorie : `flows/ml`, `connectors/github`, `meetings`… */
  unit?: string;
}

function relative(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function locate(rel: string): Location | null {
  if (rel.startsWith("apps/leaderboard-client/src/distribution/")) return { category: "distribution" };
  if (rel.startsWith("apps/leaderboard-client/")) return { category: "shell" };
  if (rel.startsWith("content/")) {
    const [, kind, name] = rel.split("/");
    return { category: "content", unit: `${kind}/${name}` };
  }
  if (rel.startsWith("modules/")) return { category: "module", unit: rel.split("/")[1] };
  if (UNSORTED_PREFIXES.some((prefix) => rel.startsWith(prefix))) return { category: "unsorted" };
  if (rel.startsWith("packages/")) return { category: "core" };
  return null;
}

function forbidden(from: Location, to: Location): boolean {
  switch (from.category) {
    case "core":
      return to.category !== "core";
    case "content":
      if (to.category === "content") return to.unit !== from.unit && !to.unit?.startsWith("kits/");
      return to.category === "module" || to.category === "distribution" || to.category === "shell";
    case "module":
      if (to.category === "module") return to.unit !== from.unit;
      return to.category === "content" || to.category === "distribution" || to.category === "shell";
    case "shell":
      return to.category === "content" || to.category === "module";
    case "unsorted":
      return to.category === "content" || to.category === "module" || to.category === "distribution" || to.category === "shell";
    case "distribution":
      return false;
  }
}

const SOURCE_DIRS = ["packages", "content", "modules", "apps/leaderboard-client/src"];

function sourceFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !entry.endsWith(".d.ts")) {
      files.push(full);
    }
  }
  return files;
}

const IMPORT_PATTERNS = [
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?[^'";]*?\sfrom\s+['"]([^'"]+)['"]/g,
  /(?:^|[\s;])import\s+['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function importedPaths(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers = new Set<string>();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }

  const resolved: string[] = [];
  for (const specifier of specifiers) {
    if (specifier.startsWith(".")) resolved.push(path.resolve(path.dirname(file), specifier));
    else if (specifier.startsWith("@/")) resolved.push(path.join(APP_SRC, specifier.slice(2)));
    else if (specifier.startsWith("@packages/")) resolved.push(path.join(ROOT, "packages", specifier.slice("@packages/".length)));
  }
  return resolved;
}

function findViolations(): string[] {
  const violations: string[] = [];
  for (const dir of SOURCE_DIRS) {
    for (const file of sourceFiles(path.join(ROOT, dir))) {
      const fromRel = relative(file);
      const from = locate(fromRel);
      if (!from) continue;
      for (const target of importedPaths(file)) {
        const toRel = relative(target).replace(/\.js$/, "");
        const to = locate(toRel);
        if (to && forbidden(from, to)) violations.push(`${fromRel} -> ${toRel}`);
      }
    }
  }
  return violations.sort();
}

describe("architecture boundaries", () => {
  const violations = findViolations();

  it("finds no import across a forbidden boundary", () => {
    expect(violations.filter((v) => !KNOWN_VIOLATIONS.includes(v))).toEqual([]);
  });

  it("keeps the list of known violations free of stale entries", () => {
    expect(KNOWN_VIOLATIONS.filter((v) => !violations.includes(v))).toEqual([]);
  });

  // Sans lecture effective des imports, les deux tests précédents passeraient
  // à vide : on vérifie sur un vrai fichier qu'un lien connu est bien vu.
  it("reads the imports of real files, aliases included", () => {
    const brief = path.join(APP_SRC, "lib/challengeBrief.ts");
    const targets = importedPaths(brief).map((target) => relative(target));

    expect(targets).toContain("apps/leaderboard-client/src/distribution/mytwin.flows");
    expect(sourceFiles(path.join(ROOT, "content")).length).toBeGreaterThan(0);
  });

  it("classifies the directories it guards", () => {
    expect(locate("packages/registry/platform.ts")?.category).toBe("core");
    expect(locate("packages/services/challenge/ml-rewards.service.ts")?.category).toBe("unsorted");
    expect(locate("content/flows/ml/index.ts")).toEqual({ category: "content", unit: "flows/ml" });
    expect(locate("apps/leaderboard-client/src/distribution/mytwin.server.ts")?.category).toBe("distribution");
    expect(locate("apps/leaderboard-client/src/lib/challengeBrief.ts")?.category).toBe("shell");
  });

  it("forbids what the boundaries forbid", () => {
    expect(forbidden({ category: "core" }, { category: "content", unit: "flows/ml" })).toBe(true);
    expect(forbidden({ category: "content", unit: "flows/ml" }, { category: "content", unit: "flows/code" })).toBe(true);
    expect(forbidden({ category: "content", unit: "flows/ml" }, { category: "content", unit: "kits/validation" })).toBe(false);
    expect(forbidden({ category: "shell" }, { category: "content", unit: "flows/ml" })).toBe(true);
    expect(forbidden({ category: "shell" }, { category: "distribution" })).toBe(false);
    expect(forbidden({ category: "module", unit: "meetings" }, { category: "module", unit: "digest" })).toBe(true);
  });
});

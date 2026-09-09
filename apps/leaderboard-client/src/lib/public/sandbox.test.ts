import { describe, expect, it } from "vitest";
import { toSandboxView, type SandboxViewer } from "./sandbox";

// Une fixture qui porte tout ce qu'on refuse de publier, pour qu'un mapper
// redevenu pass-through échoue bruyamment au lieu de fuiter en silence.
const SANDBOX = {
  uuid: "s1",
  user_id: "author-1",
  type: "ml",
  title: "Bruit de fond IRM",
  context: "contexte",
  goals: ["nettoyer", "publier"],
  why: "parce que",
  repo_url: "https://github.com/org/repo",
  model_url: "https://hf.co/org/model",
  dataset_urls: ["https://data.example/one"],
  status: "open",
  promoted_challenge_id: null,
  promoted_at: null,
  evaluation: { globalScore: 7, scores: [{ criterion: "clarity", score: 2 }] },
  evaluation_status: "done",
  evaluated_at: new Date("2026-03-01T10:00:00Z"),
  created_at: new Date("2026-02-01T10:00:00Z"),
  updated_at: new Date("2026-02-02T10:00:00Z"),
};

const AUTHOR = {
  uuid: "author-1",
  full_name: "Alix C",
  avatar_url: "https://x/a.png",
  email: "alix@example.com",
  github_username: "alix",
  role: "contributor",
};

const REWARDS = [
  {
    uuid: "r1",
    sandbox_id: "s1",
    user_id: "author-1",
    rule_key: "star_tier",
    tier_stars: 5,
    points: 50,
    created_at: new Date("2026-02-10T10:00:00Z"),
  },
];

const ANONYMOUS: SandboxViewer = { kind: "anonymous", anonId: null };
const AUTHOR_VIEWER: SandboxViewer = { kind: "account", userId: "author-1", role: "contributor" };
const ADMIN: SandboxViewer = { kind: "account", userId: "admin-1", role: "admin" };
// Un manager est rattaché à un projet ; un sandbox n'en a pas. Sur un sandbox
// il est un contributeur ordinaire — d'où le rôle `contributor` ici.
const MANAGER: SandboxViewer = { kind: "account", userId: "manager-1", role: "contributor" };
const OTHER_ADMINLESS: SandboxViewer = { kind: "account", userId: "u9", role: "medical_pro" };

function view(viewer: SandboxViewer, overrides: Record<string, unknown> = {}) {
  return toSandboxView({
    sandbox: SANDBOX,
    viewer,
    author: AUTHOR,
    starCount: 7,
    myStar: false,
    paidTierThresholds: [5],
    rewards: REWARDS,
    ...overrides,
  });
}

describe("toSandboxView", () => {
  it("ne donne ni score ni email à un visiteur anonyme", () => {
    const result = view(ANONYMOUS);

    expect(result.evaluation).toBeUndefined();
    expect(result.evaluation_status).toBeUndefined();
    expect(result.evaluated_at).toBeUndefined();
    expect(result.rewards).toBeUndefined();

    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain("alix@example.com");
    expect(serialised).not.toContain("github_username");
    expect(serialised).not.toContain("globalScore");
  });

  it("donne le score à l'auteur", () => {
    const result = view(AUTHOR_VIEWER);

    expect(result.evaluation).toEqual(SANDBOX.evaluation);
    expect(result.evaluation_status).toBe("done");
    expect(result.evaluated_at).toBe("2026-03-01T10:00:00.000Z");
    expect(result.rewards).toEqual([
      {
        uuid: "r1",
        rule_key: "star_tier",
        tier_stars: 5,
        points: 50,
        created_at: "2026-02-10T10:00:00.000Z",
      },
    ]);
  });

  it("donne le score à un admin", () => {
    expect(view(ADMIN).evaluation).toEqual(SANDBOX.evaluation);
  });

  it("ne donne pas le score à un manager, qui n'a aucun droit sur un sandbox", () => {
    expect(view(MANAGER).evaluation).toBeUndefined();
    expect(view(MANAGER).rewards).toBeUndefined();
  });

  it("ne donne pas le score à un contributeur connecté quelconque", () => {
    expect(view(OTHER_ADMINLESS).evaluation).toBeUndefined();
  });

  it("publie paid_tier_thresholds pour tout le monde", () => {
    // Non sensible, et surtout non déductible du compteur : le rattachement
    // d'une identité anonyme peut faire passer star_count sous un seuil payé.
    expect(view(ANONYMOUS, { starCount: 2 }).paid_tier_thresholds).toEqual([5]);
    expect(view(ANONYMOUS, { starCount: 2 }).star_count).toBe(2);
    expect(view(AUTHOR_VIEWER).paid_tier_thresholds).toEqual([5]);
  });

  it("résout my_star pour une identité portée par le cookie", () => {
    const cookieViewer: SandboxViewer = { kind: "anonymous", anonId: "anon-42" };

    expect(view(cookieViewer, { myStar: true }).my_star).toBe(true);
    expect(view(cookieViewer, { myStar: false }).my_star).toBe(false);
    // L'identité anonyme ne fait rien gagner d'autre : toujours pas de score.
    expect(view(cookieViewer, { myStar: true }).evaluation).toBeUndefined();
    // Et l'anon_id ne ressort jamais dans la charge utile.
    expect(JSON.stringify(view(cookieViewer, { myStar: true }))).not.toContain("anon-42");
  });

  it("réduit l'auteur à trois champs", () => {
    expect(view(ANONYMOUS).author).toEqual({
      uuid: "author-1",
      full_name: "Alix C",
      avatar_url: "https://x/a.png",
    });
  });

  it("tolère un sandbox sans auteur chargé et sans listes", () => {
    const result = toSandboxView({
      sandbox: { ...SANDBOX, goals: null, dataset_urls: null },
      viewer: ANONYMOUS,
      author: null,
      starCount: 0,
      myStar: false,
      paidTierThresholds: [],
    });

    expect(result.author).toBeNull();
    expect(result.goals).toEqual([]);
    expect(result.dataset_urls).toEqual([]);
  });
});

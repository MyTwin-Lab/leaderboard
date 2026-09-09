import { describe, expect, it } from "vitest";
import {
  canCreateSandbox,
  canSeeSandbox,
  canSeeScore,
  isAdmin,
  isAuthor,
  sandboxViewer,
  starIdentity,
} from "./sandboxAuth";

const OPEN = { user_id: "author-1", status: "open" };
const ARCHIVED = { user_id: "author-1", status: "archived" };

const author = sandboxViewer({ userId: "author-1", role: "contributor" }, null);
const admin = sandboxViewer({ userId: "admin-1", role: "admin" }, null);
// Un manager est rattaché à un projet, un sandbox n'en a pas : il arrive ici
// avec le rôle `contributor`, comme n'importe qui d'autre.
const stranger = sandboxViewer({ userId: "u9", role: "contributor" }, null);
const anonymous = sandboxViewer(null, null);

describe("sandboxViewer", () => {
  it("fait primer la session sur le cookie anonyme", () => {
    // Une star faite en étant connecté s'écrit sous user_id, jamais sous
    // anon_id — même si le navigateur porte encore un cookie sb_anon.
    const viewer = sandboxViewer({ userId: "u1", role: "contributor" }, "anon-42");

    expect(viewer).toEqual({ kind: "account", userId: "u1", role: "contributor" });
    expect(starIdentity(viewer)).toEqual({ kind: "account", userId: "u1" });
  });

  it("retombe sur l'identité anonyme sans session", () => {
    expect(sandboxViewer(null, "anon-42")).toEqual({ kind: "anonymous", anonId: "anon-42" });
  });
});

describe("starIdentity", () => {
  it("n'a aucune identité pour un visiteur sans cookie", () => {
    // PUT /star lui en fabriquera une ; DELETE /star n'a rien à retirer.
    expect(starIdentity(anonymous)).toBeNull();
  });

  it("porte l'anon_id du cookie", () => {
    expect(starIdentity(sandboxViewer(null, "anon-42"))).toEqual({
      kind: "anonymous",
      anonId: "anon-42",
    });
  });
});

describe("isAuthor / isAdmin / canSeeScore", () => {
  it("reconnaît l'auteur et l'admin", () => {
    expect(isAuthor(OPEN, author)).toBe(true);
    expect(isAuthor(OPEN, stranger)).toBe(false);
    expect(isAuthor(OPEN, anonymous)).toBe(false);
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(author)).toBe(false);
  });

  it("réserve le score à l'auteur et aux admins", () => {
    expect(canSeeScore(OPEN, author)).toBe(true);
    expect(canSeeScore(OPEN, admin)).toBe(true);
    expect(canSeeScore(OPEN, stranger)).toBe(false);
    expect(canSeeScore(OPEN, anonymous)).toBe(false);
  });
});

describe("canSeeSandbox", () => {
  it("montre un sandbox ouvert à tout le monde", () => {
    expect(canSeeSandbox(OPEN, anonymous)).toBe(true);
    expect(canSeeSandbox(OPEN, stranger)).toBe(true);
  });

  it("ne montre un archivé qu'à son auteur et aux admins", () => {
    expect(canSeeSandbox(ARCHIVED, author)).toBe(true);
    expect(canSeeSandbox(ARCHIVED, admin)).toBe(true);
    expect(canSeeSandbox(ARCHIVED, stranger)).toBe(false);
    expect(canSeeSandbox(ARCHIVED, anonymous)).toBe(false);
  });
});

describe("canCreateSandbox", () => {
  it("autorise admin, contributor et medical_pro", () => {
    expect(canCreateSandbox("admin")).toBe(true);
    expect(canCreateSandbox("contributor")).toBe(true);
    expect(canCreateSandbox("medical_pro")).toBe(true);
  });

  it("exclut viewer, qui n'a aucun droit d'écriture", () => {
    expect(canCreateSandbox("viewer")).toBe(false);
    expect(canCreateSandbox(null)).toBe(false);
    expect(canCreateSandbox(undefined)).toBe(false);
  });
});

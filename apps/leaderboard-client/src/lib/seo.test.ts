import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSitemap, pageMetadata, siteUrl, toMetaDescription, unindexedMetadata } from "./seo";

describe("siteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps only the origin of NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lab.example.com/some/path/");
    expect(siteUrl()).toBe("https://lab.example.com");
  });

  it("falls back to localhost when the variable is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("falls back to localhost when the variable is not a URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "lab.example.com");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});

describe("toMetaDescription", () => {
  it("turns markdown into one line of plain text", () => {
    const markdown = [
      "# Predict glucose",
      "",
      "Build a **model** from the [CGM dataset](https://example.com) and `ship` it.",
      "- fast",
      "- *accurate*",
      "```python",
      "print('hidden')",
      "```",
    ].join("\n");

    expect(toMetaDescription(markdown)).toBe(
      "Predict glucose Build a model from the CGM dataset and ship it. fast accurate",
    );
  });

  it("leaves underscores inside words alone", () => {
    expect(toMetaDescription("Use the glucose_level_mg column")).toBe("Use the glucose_level_mg column");
  });

  it("cuts long text on a word, within the limit", () => {
    const text = "word ".repeat(60).trim();
    const description = toMetaDescription(text, 160)!;

    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("word…")).toBe(true);
  });

  it("returns undefined when nothing readable is left", () => {
    expect(toMetaDescription(null)).toBeUndefined();
    expect(toMetaDescription("   \n  ")).toBeUndefined();
    expect(toMetaDescription("```\ncode only\n```")).toBeUndefined();
  });
});

describe("pageMetadata", () => {
  it("gives the page its own canonical URL and share preview", () => {
    const metadata = pageMetadata({ title: "Challenges", description: "Open challenges", path: "/challenges" });

    expect(metadata.title).toBe("Challenges");
    expect(metadata.alternates?.canonical).toBe("/challenges");
    expect(metadata.openGraph).toMatchObject({
      url: "/challenges",
      title: "Challenges - MyTwin Leaderboard",
      description: "Open challenges",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("keeps the site title when the page has none", () => {
    const metadata = pageMetadata({ path: "/" });

    expect(metadata).not.toHaveProperty("title");
    expect(metadata).not.toHaveProperty("description");
    expect(metadata.openGraph).toMatchObject({ title: "MyTwin Leaderboard" });
  });
});

describe("unindexedMetadata", () => {
  it("asks engines neither to index nor to follow", () => {
    expect(unindexedMetadata("Sandbox")).toEqual({
      title: "Sandbox",
      robots: { index: false, follow: false },
    });
  });
});

describe("buildSitemap", () => {
  it("lists the public pages, then every entity it is given", () => {
    const created = new Date("2026-06-01T00:00:00Z");
    const closed = new Date("2026-08-01T00:00:00Z");
    const updated = new Date("2026-09-01T00:00:00Z");

    const sitemap = buildSitemap({
      baseUrl: "https://lab.example.com",
      challenges: [
        { uuid: "c1", created_at: created, closed_at: null },
        { uuid: "c2", created_at: created, closed_at: closed },
      ],
      sandboxes: [{ uuid: "s1", updated_at: updated }],
      contributorIds: ["u1"],
    });

    expect(sitemap.map((entry) => entry.url)).toEqual([
      "https://lab.example.com/",
      "https://lab.example.com/leaderboard",
      "https://lab.example.com/challenges",
      "https://lab.example.com/sandbox",
      "https://lab.example.com/about",
      "https://lab.example.com/challenges/c1",
      "https://lab.example.com/challenges/c2",
      "https://lab.example.com/sandbox/s1",
      "https://lab.example.com/contributors/u1",
    ]);
    expect(sitemap[5].lastModified).toBe(created);
    expect(sitemap[6].lastModified).toBe(closed);
    expect(sitemap[7].lastModified).toBe(updated);
  });
});

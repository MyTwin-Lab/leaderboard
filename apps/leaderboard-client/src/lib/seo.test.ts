import { describe, expect, it } from "vitest";
import {
  LAB_ORGANIZATION_ID,
  MYTWIN,
  SITE_URL,
  breadcrumbJsonLd,
  buildSitemap,
  labOrganizationJsonLd,
  pageMetadata,
  toMetaDescription,
  unindexedMetadata,
  websiteJsonLd,
} from "./seo";

describe("SITE_URL", () => {
  it("is the production origin, without a trailing slash", () => {
    expect(SITE_URL).toBe("https://mytwinlab.care");
    expect(new URL(SITE_URL).origin).toBe(SITE_URL);
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
      siteName: "MyTwin Lab",
      title: "Challenges | MyTwin Lab",
      description: "Open challenges",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("writes an absolute title in full, bypassing the layout template", () => {
    const metadata = pageMetadata({ absoluteTitle: "About MyTwin Lab | Sandbox", path: "/about" });

    expect(metadata.title).toEqual({ absolute: "About MyTwin Lab | Sandbox" });
    expect(metadata.openGraph).toMatchObject({ title: "About MyTwin Lab | Sandbox" });
  });

  it("keeps the site title when the page has none", () => {
    const metadata = pageMetadata({ path: "/" });

    expect(metadata).not.toHaveProperty("title");
    expect(metadata).not.toHaveProperty("description");
    expect(metadata.openGraph).toMatchObject({ title: "MyTwin Lab" });
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
  it("lists the indexable pages, then every entity it is given", () => {
    const created = new Date("2026-06-01T00:00:00Z");
    const closed = new Date("2026-08-01T00:00:00Z");
    const updated = new Date("2026-09-01T00:00:00Z");

    const sitemap = buildSitemap({
      baseUrl: "https://lab.example.com",
      challenges: [
        { slug: "predict-glucose", created_at: created, closed_at: null },
        { slug: "segment-lesions", created_at: created, closed_at: closed },
      ],
      sandboxes: [{ slug: "sleep-tracker", updated_at: updated }],
      news: [{ slug: "mykine", lastModified: "2026-09-16" }],
    });

    expect(sitemap.map((entry) => entry.url)).toEqual([
      "https://lab.example.com/",
      "https://lab.example.com/challenges",
      "https://lab.example.com/sandbox",
      "https://lab.example.com/leaderboard",
      "https://lab.example.com/news",
      "https://lab.example.com/vision",
      "https://lab.example.com/terms-of-use",
      "https://lab.example.com/privacy-policy",
      "https://lab.example.com/challenges/predict-glucose",
      "https://lab.example.com/challenges/segment-lesions",
      "https://lab.example.com/sandbox/sleep-tracker",
      "https://lab.example.com/news/mykine",
    ]);
    // Les index suivent la liste ci-dessus : huit pages fixes, puis les
    // entités dans l'ordre où elles sont passées.
    expect(sitemap[8].lastModified).toBe(created);
    expect(sitemap[9].lastModified).toBe(closed);
    expect(sitemap[10].lastModified).toBe(updated);
    expect(sitemap[11].lastModified).toBe("2026-09-16");
  });
});

describe("structured data", () => {
  it("declares the Lab as a child organization of MyTwin, not as the same entity", () => {
    const organization = labOrganizationJsonLd();

    expect(organization).toMatchObject({
      "@type": "Organization",
      "@id": "https://mytwinlab.care/#organization",
      name: "MyTwin Lab",
      url: "https://mytwinlab.care",
    });
    // Must match the @id declared by mytwin.care, character for character.
    expect(organization.parentOrganization).toMatchObject({ "@id": "https://mytwin.care/#organization" });
    expect(organization.sameAs).not.toContain(MYTWIN.url);
  });

  it("publishes the website under the Lab organization", () => {
    expect(websiteJsonLd()).toMatchObject({
      "@type": "WebSite",
      name: "MyTwin Lab",
      publisher: { "@id": LAB_ORGANIZATION_ID },
    });
  });

  it("numbers breadcrumb items from 1 with absolute URLs", () => {
    const breadcrumb = breadcrumbJsonLd([
      { name: "MyTwin Lab", path: "/" },
      { name: "Challenges", path: "/challenges" },
    ]);

    expect(breadcrumb.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "MyTwin Lab", item: "https://mytwinlab.care/" },
      { "@type": "ListItem", position: 2, name: "Challenges", item: "https://mytwinlab.care/challenges" },
    ]);
  });
});

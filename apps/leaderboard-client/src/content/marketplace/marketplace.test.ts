import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { metadata as marketplaceLayoutMetadata } from "@/app/marketplace/layout";
import { buildSitemap } from "@/lib/seo";

import { MARKETPLACE_MODULES, getMarketplaceModule, moduleNumber } from ".";
import {
  isSectionDocumented,
  isSpecificationEmpty,
  pricingEntries,
  pricingSummary,
  sectionEntries,
} from "./format";
import { SPEC_SECTIONS } from "./spec";

describe("the marketplace registry", () => {
  it("lists the ten initial modules, in the catalog order", () => {
    expect(MARKETPLACE_MODULES.map((module) => [moduleNumber(module), module.name, module.provider.name])).toEqual([
      ["01", "Centralized Medical Record", "MyTwin"],
      ["02", "MyTwin Engine", "MyTwin"],
      ["03", "Dynamic Care Plan", "MyTwin"],
      ["04", "Connected Device Integration", "Terra API"],
      ["05", "Cardiovascular Health Score", "e-sensia / Saphere"],
      ["06", "Metabolic Health Score", "MyTwin"],
      ["07", "Mental Health Assessment", "Virtuosis AI"],
      ["08", "Skin Lesion Monitoring", "Skinive"],
      ["09", "Stroke and Heart Attack Prevention", "e-sensia"],
      ["10", "Daily Call from the AI Assistant", "e-sensia"],
    ]);
  });

  it("gives every module a unique, URL-safe slug that resolves back to it", () => {
    const slugs = MARKETPLACE_MODULES.map((module) => module.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const module of MARKETPLACE_MODULES) {
      expect(module.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(getMarketplaceModule(module.slug)).toBe(module);
    }
    expect(getMarketplaceModule("does-not-exist")).toBeUndefined();
  });

  it("gives every module an image that exists under public/", () => {
    for (const module of MARKETPLACE_MODULES) {
      expect(module.image, module.slug).toBe(`/marketplace/modules/${module.slug}.webp`);
      expect(existsSync(path.join(__dirname, "../../../public", module.image)), module.image).toBe(true);
    }
  });

  it("keeps the six specification sections on every module", () => {
    expect(SPEC_SECTIONS.map((section) => section.title)).toEqual([
      "Overview",
      "Capabilities",
      "Integration",
      "Pricing",
      "Licensing",
      "Compliance & Trust",
    ]);
    for (const module of MARKETPLACE_MODULES) {
      for (const { key } of SPEC_SECTIONS) {
        expect(module.specification[key], `${module.slug} › ${key}`).toBeDefined();
        expect(sectionEntries(module.specification, key).length, `${module.slug} › ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("documents the first three modules and leaves the seven others undocumented", () => {
    const documented = MARKETPLACE_MODULES.filter((module) => !isSpecificationEmpty(module)).map((module) => module.slug);
    expect(documented).toEqual(["centralized-medical-record", "mytwin-engine", "dynamic-care-plan"]);

    for (const module of MARKETPLACE_MODULES.slice(3)) {
      for (const { key } of SPEC_SECTIONS) expect(isSectionDocumented(module.specification, key)).toBe(false);
    }
  });

  it("marks the Metabolic Health Score as planned, and assumes no availability for undocumented partners", () => {
    expect(getMarketplaceModule("metabolic-health-score")?.availability.stage).toBe("planned");
    for (const slug of [
      "connected-device-integration",
      "cardiovascular-health-score",
      "mental-health-assessment",
      "skin-lesion-monitoring",
      "stroke-and-heart-attack-prevention",
      "daily-call-from-the-ai-assistant",
    ]) {
      expect(getMarketplaceModule(slug)?.availability.stage, slug).toBe("not-documented");
    }
  });

  it("publishes no price and no documentation link yet", () => {
    for (const module of MARKETPLACE_MODULES) {
      expect(module.specification.pricing.terms, module.slug).toEqual({});
      expect(module.documentationUrl, module.slug).toBeUndefined();
    }
  });
});

describe("pricing", () => {
  it("never reads a missing price as zero or free", () => {
    expect(pricingSummary({})).toBeUndefined();
    expect(pricingEntries({}).every((entry) => !entry.text && !entry.items?.length)).toBe(true);
  });

  it("shows no amount without a currency", () => {
    expect(pricingSummary({ model: "per-patient-per-month", unitPrice: 12 })).toBeUndefined();
  });

  it("summarizes a published price with its model", () => {
    expect(pricingSummary({ model: "per-patient-per-month", unitPrice: 12, currency: "EUR" })).toBe(
      "€12.00 · per patient per month",
    );
    expect(pricingSummary({ model: "custom" })).toBe("Custom pricing");
  });

  it("writes volume tiers with their billing unit", () => {
    const tiers = pricingEntries({
      model: "per-assessment",
      billingUnit: "assessments",
      currency: "EUR",
      volumeTiers: [
        { fromUnits: 1, toUnits: 999, unitPrice: 4 },
        { fromUnits: 1000, unitPrice: 3 },
      ],
    }).find((entry) => entry.label === "Volume-based pricing");
    expect(tiers?.items).toEqual(["1–999 assessments: €4.00", "1000+ assessments: €3.00"]);
  });
});

describe("indexing", () => {
  it("keeps the whole /marketplace segment out of the indexes, links still followed", () => {
    expect(marketplaceLayoutMetadata.robots).toEqual({ index: false, follow: true });
  });

  it("leaves the marketplace out of the sitemap", () => {
    const urls = buildSitemap({ baseUrl: "https://lab.example.com", challenges: [], sandboxes: [], news: [] }).map(
      (entry) => entry.url,
    );
    expect(urls.some((url) => url.includes("/marketplace"))).toBe(false);
  });
});

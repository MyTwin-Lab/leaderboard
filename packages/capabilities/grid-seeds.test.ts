import { describe, it, expect, vi } from "vitest";
import { seedGrids, toCategoryRows, type GridSeed } from "./grid-seeds.js";

const DETAILED: GridSeed = {
  slug: "code",
  name: "Code",
  grid: {
    type: "code",
    instructions: "Be fair.",
    categories: [
      {
        category: "Quality",
        weight: 0.6,
        type: "objective",
        subcriteria: [
          {
            criterion: "Complexity",
            description: "Nesting",
            metrics: ["depth <= 4"],
            scoringGuide: { excellent: "8-9", good: "5-7", average: "2-4", poor: "0-1" },
          },
        ],
      },
    ],
  },
};

const SIMPLE: GridSeed = {
  slug: "dataset",
  name: "Dataset",
  grid: {
    type: "dataset",
    instructions: "Score it.",
    criteriaTemplate: [
      { criterion: "quality", weight: 0.4 },
      { criterion: "utility", weight: 0.6 },
    ],
  },
};

describe("toCategoryRows", () => {
  it("keeps the categories of a detailed grid, with their scoring guides", () => {
    expect(toCategoryRows(DETAILED.grid)).toEqual([
      {
        name: "Quality",
        weight: 0.6,
        type: "objective",
        position: 0,
        subcriteria: [
          {
            criterion: "Complexity",
            description: "Nesting",
            metrics: ["depth <= 4"],
            indicators: undefined,
            scoring_excellent: "8-9",
            scoring_good: "5-7",
            scoring_average: "2-4",
            scoring_poor: "0-1",
            position: 0,
          },
        ],
      },
    ]);
  });

  it("gives each criterion of a simple grid its own category, so its weight survives", () => {
    const rows = toCategoryRows(SIMPLE.grid);

    expect(rows.map((r) => [r.name, r.weight, r.position])).toEqual([["quality", 0.4, 0], ["utility", 0.6, 1]]);
    expect(rows[1].subcriteria).toEqual([{ criterion: "utility", position: 0 }]);
  });
});

function makeRepo(existingSlugs: string[] = []) {
  let categories = 0;
  return {
    findBySlug: vi.fn(async (slug: string) => (existingSlugs.includes(slug) ? ({ uuid: `grid-${slug}` } as any) : null)),
    create: vi.fn(async (data: any) => ({ ...data, uuid: `grid-${data.slug}` })),
    createCategory: vi.fn(async (data: any) => ({ ...data, uuid: `cat-${++categories}` })),
    createSubcriterion: vi.fn(async (data: any) => ({ ...data, uuid: "sub" })),
    publish: vi.fn(async () => ({}) as any),
  };
}

describe("seedGrids", () => {
  it("inserts and publishes a grid that is absent", async () => {
    const repo = makeRepo();

    const report = await seedGrids([DETAILED], repo);

    expect(report).toEqual([{ slug: "code", status: "inserted" }]);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "code", name: "Code", status: "draft", instructions: "Be fair." }),
    );
    expect(repo.createCategory).toHaveBeenCalledWith(expect.objectContaining({ grid_id: "grid-code", name: "Quality" }));
    expect(repo.createSubcriterion).toHaveBeenCalledWith(expect.objectContaining({ category_id: "cat-1", criterion: "Complexity" }));
    expect(repo.publish).toHaveBeenCalledWith("grid-code");
  });

  it("never touches a grid already carrying the slug, whatever its status", async () => {
    const repo = makeRepo(["code"]);

    const report = await seedGrids([DETAILED, SIMPLE], repo);

    expect(report).toEqual([
      { slug: "code", status: "present" },
      { slug: "dataset", status: "inserted" },
    ]);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.publish).toHaveBeenCalledWith("grid-dataset");
  });
});

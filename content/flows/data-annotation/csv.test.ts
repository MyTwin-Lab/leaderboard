import { describe, it, expect } from "vitest";
import { parseCsv, toCsv } from "./csv.js";

describe("parseCsv", () => {
  it("reads a header and rows, trimming cells and lower-casing column names", () => {
    expect(parseCsv("Image_URL, class\r\nhttps://x/1.png , sensitive\nhttps://x/2.png,\n\n")).toEqual([
      { image_url: "https://x/1.png", class: "sensitive" },
      { image_url: "https://x/2.png", class: "" },
    ]);
  });

  it("handles quoted fields, doubled quotes and newlines inside quotes", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"')).toEqual([{ a: "x, y", b: 'say "hi"\nthere' }]);
  });

  it("strips a byte order mark and survives an empty file", () => {
    expect(parseCsv("﻿a\n1")).toEqual([{ a: "1" }]);
    expect(parseCsv("")).toEqual([]);
  });
});

describe("toCsv", () => {
  it("quotes what needs quoting and neutralises formulas", () => {
    expect(toCsv(["a", "b"], [["x,y", '=cmd()'], [null, true]])).toBe('a,b\r\n"x,y",\'=cmd()\r\n,true\r\n');
  });

  it("round-trips through parseCsv", () => {
    const csv = toCsv(["image_url", "consensus"], [["https://x/1.png", "benign"], ['https://x/"q".png', ""]]);
    expect(parseCsv(csv)).toEqual([
      { image_url: "https://x/1.png", consensus: "benign" },
      { image_url: 'https://x/"q".png', consensus: "" },
    ]);
  });
});

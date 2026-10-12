import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const HEADER = read("templates", "actor", "pc", "header.hbs");
const LANG = JSON.parse(read("lang", "en.json")) as Record<string, unknown>;
const lookup = (key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], LANG);

describe("natural AC sheet binding (SP21)", () => {
  it("the PC header's AC box carries the natural-AC tooltip, gated on naturalAcApplies", () => {
    expect(HEADER).toContain("adnd2e.vitals.naturalAcApplies");
    expect(HEADER).toContain("ADND2E.sheet.ac.natural");
    expect(typeof lookup("ADND2E.sheet.ac.natural")).toBe("string");
  });
  it("the sheet's race view carries the race item's naturalAc", () => {
    expect(read("src", "sheets", "character", "sheet.ts")).toContain("naturalAc: s.naturalAc ?? null");
  });
});

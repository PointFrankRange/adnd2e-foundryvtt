import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const STATBLOCK = readFileSync(path.join(ROOT, "templates", "actor", "creature", "statblock.hbs"), "utf8");
const SHEET = readFileSync(path.join(ROOT, "src", "sheets", "creature", "sheet.ts"), "utf8");
const LANG = JSON.parse(readFileSync(path.join(ROOT, "lang", "en.json"), "utf8")) as {
  ADND2E: { sheet: { creature: Record<string, string> } };
};

const registered = new Set([...SHEET.matchAll(/^\s+([a-zA-Z]+): Adnd2eCreatureSheet\.#on/gm)].map((m) => m[1]!));

describe("Monster NPC shapechange form panel (SP16 Task 5)", () => {
  it("binds the category select, the habitats chips and the giant checkbox", () => {
    expect(STATBLOCK).toContain('name="system.details.shapechange.category"');
    expect(STATBLOCK).toContain('name="system.details.shapechange.giant"');
    expect(STATBLOCK).toContain('data-action="toggleHabitat"');
    expect(STATBLOCK).toContain("shapechangeCategories");
    expect(STATBLOCK).toContain("habitatLabels");
  });

  it("registers every data-action in the template on the creature sheet", () => {
    const used = new Set([...STATBLOCK.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!));
    for (const a of used) expect(registered.has(a), a).toBe(true);
    expect(registered.has("toggleHabitat")).toBe(true);
  });

  it("has every copy key the template uses", () => {
    const keys = [...STATBLOCK.matchAll(/ADND2E\.sheet\.creature\.(shapechange[A-Za-z]+)/g)].map((m) => m[1]!);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of new Set(keys)) expect(LANG.ADND2E.sheet.creature[k], k).toBeTruthy();
    for (const k of ["shapechangeTitle", "shapechangeCategory", "shapechangeHabitats", "shapechangeGiant", "shapechangeNotAForm", "shapechangeHint"])
      expect(LANG.ADND2E.sheet.creature[k], k).toBeTruthy();
  });
});

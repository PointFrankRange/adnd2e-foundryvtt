import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { raceAllowsClasses, raceTablesOf } from "../../src/core/races";

const dir = path.resolve(__dirname, "..", "..", "packs", "races", "_source");
const races = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { name: string; system: unknown });

describe("races pack — class eligibility data", () => {
  it("every listed multiclass combination uses only allowed classes and is itself accepted", () => {
    for (const r of races) {
      const t = raceTablesOf(r.system);
      for (const combo of t.allowedMulticlass) {
        expect(combo.every((c) => t.allowedClasses.includes(c)), `${r.name}: ${combo.join("/")}`).toBe(true);
        expect(raceAllowsClasses(t, combo), `${r.name}: ${combo.join("/")}`).toEqual({ ok: true });
      }
    }
  });

  it("every race accepts each of its own allowed classes alone", () => {
    for (const r of races) {
      const t = raceTablesOf(r.system);
      for (const c of t.allowedClasses) expect(raceAllowsClasses(t, [c]).ok, `${r.name}: ${c}`).toBe(true);
    }
  });

  it("PHB spot checks: a dwarf cannot be a mage, an elf fighter/mage is fine, a human may take any two", () => {
    const get = (n: string) => raceTablesOf(races.find((r) => r.name === n)!.system);
    expect(raceAllowsClasses(get("Dwarf"), ["mage"]).ok).toBe(false);
    expect(raceAllowsClasses(get("Elf"), ["mage", "fighter"]).ok).toBe(true);
    expect(raceAllowsClasses(get("Human"), ["mage", "cleric"]).ok).toBe(true);
  });
});

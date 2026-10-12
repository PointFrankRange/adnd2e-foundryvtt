import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}
const files = walk("src").map((p) => ({ p: p.split(sep).join("/"), text: readFileSync(p, "utf8") }));

const TABLES: Array<[string, string | null]> = [
  ["RACIAL_ABILITY_ADJUSTMENTS", "src/core/abilities/racial-adjustments.ts"],
  ["RACIAL_ABILITY_LIMITS", "src/core/abilities/racial-adjustments.ts"],
  ["THIEF_RACIAL_ADJUSTMENTS", "src/core/proficiencies/thief-skills.ts"],
  ["RACIAL_SAVE_CATEGORIES", "src/core/saves/racial.ts"],
  ["BASE_MOVEMENT", null],
];

describe("race code tables are only indexed inside their helper", () => {
  for (const [name, home] of TABLES) {
    it(name, () => {
      const hits = files
        .map((f) => ({ p: f.p, n: f.text.split(`${name}[`).length - 1 }))
        .filter((h) => h.n > 0);
      if (home === null) expect(hits, `unexpected index access: ${hits.map((h) => h.p)}`).toEqual([]);
      else expect(hits, `index access must live only in ${home}`).toEqual([{ p: home, n: 1 }]);
    });
  }
  it("the old closed RACE_IDS list is gone from race/kit schemas", () => {
    for (const f of files.filter((x) => x.p === "src/data/item/race.ts" || x.p === "src/data/item/kit.ts")) {
      expect(/\bRACE_IDS\b/.test(f.text.replace(/PHB_RACE_IDS/g, "")), f.p).toBe(false);
    }
  });
});

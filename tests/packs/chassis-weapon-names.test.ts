import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { getChassis } from "../../src/core/classes/chassis";
import { CLASS_IDS } from "../../src/data/item/choices";

// Lives here (not tests/core) because the core tsconfig has no node types.
describe("chassis weapon names match the weapon-proficiency pack", () => {
  // Names with no pack entry (explicitly accepted); "staff" is the quarterstaff alias.
  // "dirk", "throwing axe" and "war hammer" are the Psionicist list (PHBR5); the pack has no such entries.
  const NO_PACK_ENTRY = ["lasso", "sickle", "dirk", "throwing axe", "war hammer"];
  it("every chassis weapon name is a pack weapon name, the staff alias, or an allow-listed name", () => {
    const dir = path.resolve(__dirname, "..", "..", "packs", "weapon-proficiencies", "_source");
    const packNames = new Set(
      readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => (JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { name: string }).name.toLowerCase()),
    );
    const unmatched = new Set<string>();
    for (const id of CLASS_IDS) {
      const allowed = getChassis(id).weaponsAllowed;
      if (allowed === "any") continue;
      for (const n of allowed.names ?? []) {
        const key = n.trim().toLowerCase();
        const covered = packNames.has(key) || (key === "staff" && packNames.has("quarterstaff")) || NO_PACK_ENTRY.includes(key);
        if (!covered) unmatched.add(key);
      }
    }
    expect([...unmatched].sort()).toEqual([]);
  });
});

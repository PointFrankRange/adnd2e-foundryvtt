import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const TPL = path.join(ROOT, "templates");
const SHEET = readFileSync(path.join(ROOT, "src", "sheets", "creature", "sheet.ts"), "utf8");

const PART_FILES = [...SHEET.matchAll(/TEMPLATE_PATH\("(actor\/[a-z]+)", "([a-z-]+\.hbs)"\)/g)].map((m) =>
  path.join(TPL, ...m[1]!.split("/"), m[2]!),
);
// follow {{> adnd2e.<name>}} includes transitively (pc/partials, then shared/partials)
function reach(files: string[]): string[] {
  const seen = new Set(files);
  const queue = [...files];
  while (queue.length) {
    const text = readFileSync(queue.shift()!, "utf8");
    for (const m of text.matchAll(/\{\{>\s*adnd2e\.([a-z-]+)/g)) {
      const hit = [path.join(TPL, "actor", "pc", "partials", `${m[1]}.hbs`), path.join(TPL, "actor", "shared", "partials", `${m[1]}.hbs`)].find(existsSync);
      if (!hit) throw new Error(`unresolved partial adnd2e.${m[1]}`);
      if (!seen.has(hit)) { seen.add(hit); queue.push(hit); }
    }
  }
  return [...seen];
}
const FILES = reach(PART_FILES);
const TEMPLATES = FILES.map((f) => readFileSync(f, "utf8")).join("\n");

const NOTHING_LOST_ACTIONS = ["editImage", "rollAttack", "deleteAttack", "addAttack", "rollWeaponAttack", "toggleEquipped", "editItem", "deleteItem", "castMonsterSpell", "rollSave"];
const NOTHING_LOST_NAMES = [
  "name", "system.details.size", "system.details.alignment", "system.attributes.ac.value", "system.hd.count", "system.hd.dieType",
  "system.hd.bonus", "system.hd.fixedHp", "system.attributes.hp.value", "system.attributes.thac0.value", "system.attributes.thac0.asFighterLevel",
  "system.attributes.movement.land", "system.attributes.movement.burrow", "system.attributes.movement.climb", "system.attributes.movement.fly",
  "system.attributes.movement.swim", "system.attributes.movement.flyManeuverability",
  "system.attacks.{{@index}}.name", "system.attacks.{{@index}}.count", "system.attacks.{{@index}}.damage", "system.attacks.{{@index}}.type",
  "system.attacks.{{@index}}.special", "system.attacks.{{@index}}.thac0Override",
  "system.saves.mode", "system.saves.explicit.{{row.category}}", "system.saves.asClass.group", "system.saves.asClass.level",
  "system.details.intelligence", "system.details.morale", "system.details.magicResistance", "system.details.treasureType",
  "system.details.numberAppearing", "system.details.xpValue", "system.details.specialAttacks", "system.details.specialDefenses", "system.details.description",
].map((n) => `name="${n}"`);
const CORE_ACTIONS = new Set(["tab", "editImage"]);
const registered = new Set([...SHEET.matchAll(/^\s+([a-zA-Z]+): Adnd2eCreatureSheet\.#on/gm)].map((m) => m[1]!));

describe("Monster NPC sheet templates (sheet redesign R3)", () => {
  it("uses the kit part templates", () => {
    expect(PART_FILES.map((f) => path.relative(TPL, f).split(path.sep).join("/")).sort()).toEqual([
      "actor/creature/gear.hbs", "actor/creature/header.hbs", "actor/creature/left.hbs", "actor/creature/notes.hbs",
      "actor/creature/spells.hbs", "actor/creature/statblock.hbs", "actor/pc/tabs.hbs", "actor/shared/effects.hbs",
    ]);
  });

  it("keep every pre-redesign creature binding (nothing lost)", () => {
    for (const a of NOTHING_LOST_ACTIONS) expect(TEMPLATES, a).toContain(`data-action="${a}"`);
    for (const n of NOTHING_LOST_NAMES) expect(TEMPLATES, n).toContain(n);
  });

  it("every data-action is registered on the creature sheet (or core); lock is wired; no favorites", () => {
    const used = new Set([...TEMPLATES.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!));
    for (const a of used) expect(registered.has(a) || CORE_ACTIONS.has(a), a).toBe(true);
    expect(registered.has("toggleLock")).toBe(true);
    expect(TEMPLATES).not.toContain("toggleFavorite");
    expect(registered.has("toggleFavorite")).toBe(false);
  });

  it("binds the monster types and the Table 61 row", () => {
    expect(TEMPLATES).toContain('data-action="toggleMonsterType"');
    expect(TEMPLATES).toContain('name="system.details.turning.row"');
    expect(registered.has("toggleMonsterType")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const TPL = path.join(ROOT, "templates");
const SHEET = readFileSync(path.join(ROOT, "src", "sheets", "npc", "sheet.ts"), "utf8");

// The NPC sheet's PARTS templates (parsed from sheet.ts) + every partial reachable
// from them via `{{> adnd2e.<name>}}` includes, walked transitively so a partial
// that itself includes another partial (e.g. journal.hbs -> pc-feature-panels.hbs)
// is still picked up. A name that resolves to neither partials folder fails the walk.
const PART_FILES = [...SHEET.matchAll(/TEMPLATE_PATH\("(actor\/[a-z]+)", "([a-z-]+\.hbs)"\)/g)].map((m) =>
  path.join(TPL, ...m[1]!.split("/"), m[2]!),
);

function resolvePartial(name: string): string {
  const pcPath = path.join(TPL, "actor", "pc", "partials", `${name}.hbs`);
  const sharedPath = path.join(TPL, "actor", "shared", "partials", `${name}.hbs`);
  if (existsSync(pcPath)) return pcPath;
  if (existsSync(sharedPath)) return sharedPath;
  throw new Error(`{{> adnd2e.${name}}} does not resolve to a partial under templates/actor/{pc,shared}/partials/`);
}

const visited = new Set<string>(PART_FILES);
const queue = [...PART_FILES];
const reachedPartials: string[] = [];
while (queue.length) {
  const file = queue.shift()!;
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/\{\{>\s*adnd2e\.([a-z-]+)/g)) {
    const resolved = resolvePartial(m[1]!);
    if (visited.has(resolved)) continue;
    visited.add(resolved);
    reachedPartials.push(resolved);
    queue.push(resolved);
  }
}
const FILES = [...PART_FILES, ...reachedPartials];
const TEMPLATES = FILES.map((f) => readFileSync(f, "utf8")).join("\n");

const NOTHING_LOST_ACTIONS = [
  "editImage", "editItem", "deleteItem", "rollHp", "takeAverageHp", "rollSave", "rollAttack", "advanceWeaponMastery",
  "rollNonweaponCheck", "rollThiefSkill", "restSpellcasting", "learnSpell", "memorizeSpell", "forgetSpell", "castSpell",
  "completeCasting", "disruptCasting", "cancelCasting",
];
const NOTHING_LOST_NAMES = [
  'name="name"', 'name="system.details.alignment"', 'name="system.npc.morale"', 'name="system.npc.xpValue"',
  'name="system.npc.disposition"', 'name="system.abilities.{{row.key}}.score"', 'name="system.abilities.str.exceptional"',
  'name="system.attributes.hp.value"', 'name="system.attributes.hp.temp"', 'name="system.currency.pp"',
  'name="system.currency.gp"', 'name="system.currency.ep"', 'name="system.currency.sp"', 'name="system.currency.cp"',
  'name="system.resources.reputation"', 'name="system.resources.henchmen"', 'name="system.resources.followers"',
  'name="system.details.{{field}}"', 'name="system.biography"', 'name="system.details.campaignNotes"',
  'name="system.details.gmNotes"',
];
const NOTHING_LOST_FIELDS = ['data-field="quantity"', 'data-field="location"', 'data-field="equipped"', 'data-field="identified"'];
// `removeTrait` is deliberately NOT here: the Character NPC sheet lists owned traits read-only and lets an unlocked
// owner remove one (#114) — adding/pooling traits stays PC-only (drops refused, no ledger).
const PC_ONLY_ACTIONS = [
  "awardXp", "toggleDualClass", "seedSubAbilities", "allocateThiefSkillPoint", "deallocateThiefSkillPoint", "turnUndead", "resetTurnAttempt", "useKitPower", "resetKitPower", "newDayKitPowers", "newEncounterKitPowers",
  // Sub-project 14 Plan A: wizard spell points' Free Magicks panel (memorize/cast/forget a
  // free magick) is gated behind `@root.pcActions` in spells.hbs, same as this list's other
  // entries — the Character NPC sheet reuses that same shared PC template but its sheet.ts
  // has no matching action-map wiring for these three (that's PC-sheet-only, Task 4/5 of SP14a).
  "memorizeFreeMagick", "castFreeMagick", "forgetFreeMagick",
  // Sub-project 14 priest theurgies: the priest free-theurgy controls in spells.hbs are gated
  // behind `@root.pcActions` too, and only the PC sheet wires these three actions.
  "memorizeFreeTheurgy", "castFreeTheurgy", "forgetFreeTheurgy",
  // SP15 Plan D: the Wild talent panel is PC-only (gated behind `@root.pcActions`).
  "wildTalentTest", "wildTalentReset",
  // #94: the Stand Up button (prone panel) is gated behind `@root.pcActions`; only the PC sheet wires it.
  "standUp",
  // Sub-project 14 Plan B whole-branch fix I2: recoverChannellerSp is NOT
  // PC-only — a Character NPC channeller needs to recover spell points too,
  // so the Recover button in spells.hbs is unconditional and this sheet now
  // wires the same recoverChannellerSp/promptRecoverChannelling functions the
  // PC sheet uses. (Removed from this list; kept here only as history.)
  // Sub-project 14 Plan C whole-branch review finding I1: recoverFromFatigue
  // is likewise NOT PC-only — the fatigue panel's Recover button is now
  // unconditional (gated only on `adnd2e.vitals.canRecoverFatigue`) and this
  // sheet wires the same recoverFromFatigue function the PC sheet uses.
  // (Removed from this list; kept here only as history.)
];
const CORE_ACTIONS = new Set(["tab", "editImage"]);
const registered = new Set([...SHEET.matchAll(/^\s+([a-zA-Z]+): Adnd2eNpcSheet\.#on/gm)].map((m) => m[1]!));

describe("Character NPC sheet templates (sheet redesign R2)", () => {
  it("uses the kit part templates", () => {
    expect(PART_FILES.map((f) => path.relative(TPL, f).split(path.sep).join("/")).sort()).toEqual(
      ["actor/npc/journal.hbs", "actor/npc/main.hbs", "actor/pc/header.hbs", "actor/pc/inventory.hbs", "actor/pc/left.hbs", "actor/pc/spells.hbs", "actor/pc/tabs.hbs"],
    );
  });

  it("keep every pre-redesign NPC binding (nothing lost)", () => {
    for (const a of NOTHING_LOST_ACTIONS) expect(TEMPLATES, a).toContain(`data-action="${a}"`);
    for (const n of NOTHING_LOST_NAMES) expect(TEMPLATES, n).toContain(n);
    for (const f of NOTHING_LOST_FIELDS) expect(TEMPLATES, f).toContain(f);
    expect(TEMPLATES).toContain('class="weapon-row');
    expect(TEMPLATES).toContain('class="backstab-toggle"');
    expect(TEMPLATES).toContain('class="maneuver-select"');
  });

  it("every non-PC-only data-action is registered on the NPC sheet (or core); favorite actions too", () => {
    const used = new Set([...TEMPLATES.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!));
    for (const a of used) {
      if (PC_ONLY_ACTIONS.includes(a)) continue;
      expect(registered.has(a) || CORE_ACTIONS.has(a), a).toBe(true);
    }
    const favSrc = readFileSync(path.join(ROOT, "src", "sheets", "kit", "favorites.ts"), "utf8");
    const union = favSrc.match(/action:\s*([^;]+);/)![1]!;
    for (const m of union.matchAll(/"([a-zA-Z]+)"/g)) expect(registered.has(m[1]!), m[1]!).toBe(true);
    expect(registered.has("toggleLock") && registered.has("toggleFavorite")).toBe(true);
  });

  it("never registers or renders PC-only actions ungated", () => {
    for (const a of PC_ONLY_ACTIONS) expect(registered.has(a), a).toBe(false);
    for (const f of FILES) {
      const text = readFileSync(f, "utf8");
      const used = PC_ONLY_ACTIONS.filter((a) => text.includes(`data-action="${a}"`));
      if (!used.length) continue;
      expect(f.includes(`${path.sep}npc${path.sep}`), `${f} must not contain PC-only actions`).toBe(false);
      expect(text, `${f} renders ${used.join(", ")} ungated`).toContain("@root.pcActions");
    }
    expect(SHEET).not.toMatch(/pcActions\s*[:=]/);
  });
});

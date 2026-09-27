import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const TPL = path.join(ROOT, "templates");
const SHEET = readFileSync(path.join(ROOT, "src", "sheets", "npc", "sheet.ts"), "utf8");

function allHbs(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? allHbs(p) : p.endsWith(".hbs") ? [p] : [];
  });
}

// The NPC sheet's PARTS templates (parsed from sheet.ts) + every partial they can reach.
const PART_FILES = [...SHEET.matchAll(/TEMPLATE_PATH\("(actor\/[a-z]+)", "([a-z-]+\.hbs)"\)/g)].map((m) =>
  path.join(TPL, ...m[1]!.split("/"), m[2]!),
);
const PARTIAL_FILES = [...allHbs(path.join(TPL, "actor", "pc", "partials")), ...allHbs(path.join(TPL, "actor", "shared", "partials"))];
const FILES = [...PART_FILES, ...PARTIAL_FILES];
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
const PC_ONLY_ACTIONS = ["awardXp", "toggleDualClass", "seedSubAbilities", "allocateThiefSkillPoint", "deallocateThiefSkillPoint", "removeTrait"];
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
    expect(SHEET).not.toMatch(/pcActions\s*=\s*true/);
  });
});

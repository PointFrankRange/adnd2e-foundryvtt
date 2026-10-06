import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const PC_DIR = path.join(ROOT, "templates", "actor", "pc");

function allHbs(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? allHbs(p) : p.endsWith(".hbs") ? [p] : [];
  });
}
const TEMPLATES = allHbs(PC_DIR).map((p) => readFileSync(p, "utf8")).join("\n")
  // the shared item-controls partial is reused by the PC templates
  + readFileSync(path.join(ROOT, "templates", "actor", "shared", "partials", "item-controls.hbs"), "utf8");
const SHEET = readFileSync(path.join(ROOT, "src", "sheets", "character", "sheet.ts"), "utf8");
const FAVORITES = readFileSync(path.join(ROOT, "src", "sheets", "kit", "favorites.ts"), "utf8");

const NOTHING_LOST_ACTIONS = [
  "advanceWeaponMastery", "allocateThiefSkillPoint", "awardXp", "cancelCasting", "castSpell", "completeCasting",
  "deallocateThiefSkillPoint", "deleteItem", "disruptCasting", "editImage", "editItem", "forgetSpell", "learnSpell",
  "memorizeSpell", "removeTrait", "restSpellcasting", "rollAttack", "rollHp", "rollNonweaponCheck", "rollSave",
  "rollThiefSkill", "seedSubAbilities", "takeAverageHp", "toggleDualClass",
];
const NOTHING_LOST_NAMES = [
  'name="name"', 'name="system.abilities.{{row.key}}.score"', 'name="system.abilities.str.exceptional"',
  'name="{{sub.name}}"', 'name="system.attributes.hp.value"', 'name="system.attributes.hp.temp"', 'name="system.biography"',
  'name="system.currency.pp"', 'name="system.currency.gp"', 'name="system.currency.ep"', 'name="system.currency.sp"',
  'name="system.currency.cp"', 'name="system.details.alignment"', 'name="system.details.campaignNotes"',
  'name="system.details.gmNotes"', 'name="system.details.{{field}}"', 'name="system.options.skillsAndPowers.characterPoints.pool"',
  'name="system.resources.reputation"', 'name="system.resources.henchmen"', 'name="system.resources.followers"',
];
const NOTHING_LOST_FIELDS = ['data-field="quantity"', 'data-field="location"', 'data-field="equipped"', 'data-field="identified"'];
const CORE_ACTIONS = new Set(["tab", "editImage"]);

describe("PC sheet templates (sheet redesign R1)", () => {
  it("keep every pre-redesign binding (nothing lost)", () => {
    for (const a of NOTHING_LOST_ACTIONS) expect(TEMPLATES, a).toContain(`data-action="${a}"`);
    for (const n of NOTHING_LOST_NAMES) expect(TEMPLATES, n).toContain(n);
    for (const f of NOTHING_LOST_FIELDS) expect(TEMPLATES, f).toContain(f);
    expect(TEMPLATES).toContain('class="weapon-row');
    expect(TEMPLATES).toContain('class="backstab-toggle"');
    expect(TEMPLATES).toContain('class="maneuver-select"');
  });

  it("every data-action used by a PC template is registered on the PC sheet (or is a core action)", () => {
    const used = new Set([...TEMPLATES.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!));
    const registered = new Set([...SHEET.matchAll(/^\s+([a-zA-Z]+): Adnd2eCharacterSheet\.#on/gm)].map((m) => m[1]!));
    for (const a of used) expect(registered.has(a) || CORE_ACTIONS.has(a), a).toBe(true);
  });

  it("every action a FavoriteRow can carry (rendered dynamically as data-action=\"{{f.action}}\", invisible to the static scan above) is registered on the PC sheet", () => {
    // FavoriteRow["action"]'s union literal, e.g.:
    //   action: "rollAttack" | "castSpell" | "rollThiefSkill" | "editItem" | null;
    const unionLine = FAVORITES.match(/^\s*action:\s*(.+);\s*$/m)?.[1];
    expect(unionLine, "FavoriteRow's action union not found in favorites.ts").toBeTruthy();
    const favoriteActions = [...unionLine!.matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]!);
    expect(favoriteActions.length).toBeGreaterThan(0);
    const registered = new Set([...SHEET.matchAll(/^\s+([a-zA-Z]+): Adnd2eCharacterSheet\.#on/gm)].map((m) => m[1]!));
    for (const a of favoriteActions) expect(registered.has(a), a).toBe(true);
  });
});

const PC_ONLY_ACTIONS = ["awardXp", "toggleDualClass", "seedSubAbilities", "allocateThiefSkillPoint", "deallocateThiefSkillPoint", "removeTrait", "useKitPower", "resetKitPower", "newDayKitPowers", "newEncounterKitPowers", "usePsionicPower", "relearnPsionicPower", "psionicRest", "adjustPsionicPsp", "payPsionicMaintenance", "endPsionicPower", "psionicRaiseDefense", "psionicDropDefense", "psionicAttack", "psionicPayUpkeep", "psionicEndContact"];

describe("PC-only actions (sheet redesign R2)", () => {
  it("every PC template that renders a PC-only action gates it on @root.pcActions", () => {
    for (const file of allHbs(PC_DIR)) {
      const text = readFileSync(file, "utf8");
      const used = PC_ONLY_ACTIONS.filter((a) => text.includes(`data-action="${a}"`));
      if (used.length) expect(text, `${file} renders ${used.join(", ")}`).toContain("@root.pcActions");
    }
  });
  it("the PC sheet sets pcActions", () => {
    expect(SHEET).toMatch(/context\.pcActions = true;/);
  });
});

describe("Psionics tab (SP15 Plan A)", () => {
  const psionicsTemplate = readFileSync(path.join(PC_DIR, "psionics.hbs"), "utf8");
  it("every psionic action is rendered by a template and registered on the sheet", () => {
    for (const a of ["usePsionicPower", "relearnPsionicPower", "psionicRest", "adjustPsionicPsp", "payPsionicMaintenance", "endPsionicPower"]) {
      expect(TEMPLATES, a).toContain(`data-action="${a}"`);
      expect(SHEET, a).toContain(`${a}: Adnd2eCharacterSheet.#on`);
    }
  });
  it("the part and tab are declared, and the section is the psionics tab", () => {
    expect(SHEET).toContain('psionics: { template: TP("psionics.hbs")');
    expect(SHEET).toContain('{ id: "psionics", icon:');
    expect(psionicsTemplate).toContain('data-tab="{{tab.id}}"');
  });
  it("the Adjust PSPs input is read by data attribute", () => {
    const panel = readFileSync(path.join(PC_DIR, "partials", "pc-psionics-panels.hbs"), "utf8");
    expect(panel).toContain("data-psionic-adjust");
    expect(SHEET).toContain("[data-psionic-adjust]");
  });
  it("rest inputs carry no name= (they must not be submitted as actor data)", () => {
    const panel = readFileSync(path.join(PC_DIR, "partials", "pc-psionics-panels.hbs"), "utf8");
    expect(panel).not.toMatch(/name="/);
  });
});

describe("Psionic combat panel (SP15 Plan C)", () => {
  const COMBAT_ACTIONS = ["psionicRaiseDefense", "psionicDropDefense", "psionicAttack", "psionicPayUpkeep", "psionicEndContact"];
  it("every combat action is rendered by a template, registered on the sheet and PC-only", () => {
    for (const a of COMBAT_ACTIONS) {
      expect(TEMPLATES, a).toContain(`data-action="${a}"`);
      expect(SHEET, a).toContain(`${a}: Adnd2eCharacterSheet.#on`);
      expect(PC_ONLY_ACTIONS, a).toContain(a);
    }
  });
  it("the defense select is read by data attribute and carries no name=", () => {
    const panel = readFileSync(path.join(PC_DIR, "partials", "pc-psionics-panels.hbs"), "utf8");
    expect(panel).toContain("data-psionic-defense");
    expect(SHEET).toContain("[data-psionic-defense]");
    expect(panel).not.toMatch(/name="/);
  });
});

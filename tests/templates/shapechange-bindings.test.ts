import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const FEATURES = read("templates", "actor", "pc", "partials", "pc-feature-panels.hbs");
const HEADER = read("templates", "actor", "pc", "header.hbs");
const MAIN = read("templates", "actor", "pc", "partials", "pc-main-panels.hbs");
const SHEET = read("src", "sheets", "character", "sheet.ts");
const NPC_SHEET = read("src", "sheets", "npc", "sheet.ts");
const LANG = JSON.parse(read("lang", "en.json")) as Record<string, unknown>;
const ACTIONS = ["shapechangeShift", "shapechangeReturn", "shapechangeNewDay", "rollFormAttack"];

const lookup = (key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], LANG);

describe("shapechange sheet bindings (SP16)", () => {
  it("the Features panel is PC-only and offers shift, return and new day", () => {
    expect(FEATURES).toContain("shapechange");
    expect(FEATURES).toContain('data-action="shapechangeShift"');
    expect(FEATURES).toContain('data-action="shapechangeNewDay"');
    expect(FEATURES).toContain('data-action="shapechangeReturn"');
    expect(FEATURES).toMatch(/@root\.pcActions[\s\S]*@root\.shapechange\.visible/);
  });
  it("the header shows the shifted banner with a return button, gated on pcActions", () => {
    expect(HEADER).toContain('data-action="shapechangeReturn"');
    expect(HEADER).toMatch(/@root\.pcActions\}\}\{\{#if @root\.shapechange\.form/);
  });
  it("the main panel lists form attacks while shifted and keeps the weapon list otherwise", () => {
    expect(MAIN).toContain('data-action="rollFormAttack"');
    expect(MAIN).toContain('data-index="{{@index}}"');
    expect(MAIN).toContain('data-action="rollAttack"');
    expect(MAIN).toContain("adnd2e.combat.weapons");
  });
  for (const action of ACTIONS) {
    it(`the PC sheet registers ${action}`, () => {
      expect(SHEET).toMatch(new RegExp(`^\\s+${action}: Adnd2eCharacterSheet\\.#on`, "m"));
    });
  }
  it("the Character NPC sheet sets neither pcActions nor shapechange, so the shared templates render unchanged", () => {
    expect(NPC_SHEET).not.toMatch(/context\.pcActions\s*=/);
    expect(NPC_SHEET).not.toMatch(/context\.shapechange\s*=/);
  });
  it("rolling a weapon attack is refused while shapechanged (the Favorites panel also offers rollAttack)", () => {
    const handler = SHEET.slice(SHEET.indexOf("static async #onRollAttack"), SHEET.indexOf("static async #onRollSave"));
    expect(handler).toMatch(/system\.shapechange\.form\)\s*\{[\s\S]*?weaponsUnavailable[\s\S]*?return;/);
    expect(handler.indexOf("weaponsUnavailable")).toBeLessThan(handler.indexOf("rollAttack("));
    expect(typeof lookup("ADND2E.sheet.shapechange.weaponsUnavailable")).toBe("string");
  });
  it("the Kits panel hides Use and Reset for the shapechange power the Shapechange panel manages", () => {
    expect(FEATURES).toMatch(/\{\{#unless p\.managed\}\}[\s\S]*useKitPower[\s\S]*resetKitPower[\s\S]*\{\{\/unless\}\}/);
    expect(SHEET).toMatch(/managed: true, canUse: false, canReset: false/);
  });
  it("the Shift button has a single disabled condition", () => {
    const line = FEATURES.split(/\r?\n/).find((l) => l.includes('data-action="shapechangeShift"'))!;
    expect(line.match(/disabled/g)).toHaveLength(1);
    expect(line).toContain("shapechange.canShiftNow");
  });
  it("every ADND2E.sheet.shapechange key the templates use exists in lang/en.json", () => {
    const used = new Set<string>();
    for (const src of [FEATURES, HEADER, MAIN]) {
      for (const m of src.matchAll(/ADND2E\.sheet\.shapechange\.[A-Za-z.]+/g)) used.add(m[0]);
    }
    expect(used.size).toBeGreaterThan(0);
    for (const key of used) expect(typeof lookup(key), key).toBe("string");
  });
});

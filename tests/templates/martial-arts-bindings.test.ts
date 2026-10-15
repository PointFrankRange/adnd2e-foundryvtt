import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const MAIN = read("templates", "actor", "pc", "partials", "pc-main-panels.hbs");
const FEATURES = read("templates", "actor", "pc", "partials", "pc-feature-panels.hbs");
const CHAT = read("templates", "chat", "martial-arts-attack.hbs");
const SHEET = read("src", "sheets", "character", "sheet.ts");
const NPC_SHEET = read("src", "sheets", "npc", "sheet.ts");
const ACTIONS = read("src", "sheets", "character", "martial-arts-actions.ts");
const CARD = read("src", "core", "martial-arts", "card.ts");
const LANG = JSON.parse(read("lang", "en.json")) as Record<string, unknown>;

const lookup = (key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], LANG);
const keysIn = (src: string, re: RegExp): string[] => [...new Set([...src.matchAll(re)].map((m) => m[0]))];

describe("martial arts bindings (SP18 Plan A)", () => {
  it("the panel is PC-only, rule-gated, with Attack and a Use button per style", () => {
    expect(MAIN).toMatch(/@root\.pcActions[\s\S]*@root\.martialArts\.visible[\s\S]*data-action="martialArtsAttack"/);
    const attack = MAIN.split(/\r?\n/).find((l) => l.includes('data-action="martialArtsAttack"'))!;
    expect(attack.match(/disabled/g)).toHaveLength(1);
    expect(attack).toContain("martialArts.canAttack");
    expect(MAIN).toContain('data-action="useMartialStyle"');
    expect(MAIN).not.toContain('name="system.martialArts.knowsBasics"');
    expect(FEATURES).toContain('name="system.martialArts.knowsBasics"');
    expect(FEATURES).toMatch(/@root\.pcActions[\s\S]*@root\.martialArts\.visible[\s\S]*ADND2E\.sheet\.martialArts\.manageTitle/);
  });
  it("the PC sheet registers both actions; the Character NPC sheet sets neither pcActions nor martialArts", () => {
    expect(SHEET).toMatch(/^\s+martialArtsAttack: Adnd2eCharacterSheet\.#on/m);
    expect(SHEET).toMatch(/^\s+useMartialStyle: Adnd2eCharacterSheet\.#on/m);
    expect(NPC_SHEET).not.toMatch(/context\.(pcActions|martialArts)\s*=/);
  });
  it("every sheet, chat and drop key used exists in lang/en.json", () => {
    const keys = new Set([
      ...keysIn(MAIN, /ADND2E\.sheet\.martialArts\.[A-Za-z]+/g),
      ...keysIn(FEATURES, /ADND2E\.sheet\.martialArts\.[A-Za-z]+/g),
      // the lock-reason table is a dynamic prefix (locked.${reason}); the Plan B1 bindings test covers each reason
      ...keysIn(ACTIONS, /ADND2E\.(sheet|chat)\.martialArts\.[A-Za-z]+/g).filter((k) => !k.endsWith(".locked") && !k.endsWith(".mod") && !k.endsWith(".weapon")),
      ...keysIn(CHAT, /ADND2E\.chat\.martialArts\.[A-Za-z]+/g),
      ...keysIn(CARD, /ADND2E\.chat\.martialArts\.(?:mod\.)?[A-Za-z0-9]+/g).filter((k) => !k.endsWith(".weapon")),
      "ADND2E.sheet.drop.styleNeedsBasics", "ADND2E.sheet.drop.styleDuplicate",
    ]);
    expect(keys.size).toBeGreaterThan(10);
    for (const key of keys) expect(typeof lookup(key), key).toBe("string");
  });
  it("the Apply Damage button is hidden at zero damage; refusal key and PC-only drop guard exist", () => {
    expect(CHAT).toMatch(/{{#if damage}}<button[^>]*data-action="applyDamage"/);
    expect(NPC_SHEET).toContain("ADND2E.sheet.drop.stylesPcOnly");
    expect(lookup("ADND2E.sheet.drop.stylesPcOnly")).toBe("Martial arts styles can only be learned by player characters.");
  });
  it("the card reuses the generic applyDamage action", () => {
    expect(CHAT).toContain('data-action="applyDamage"');
    expect(CHAT).toContain('data-amount="{{damage}}"');
  });
  it("the manual-AC prompt goes through themedPrompt, never DialogV2 directly", () => {
    expect(ACTIONS).toContain("themedPrompt");
    expect(ACTIONS).not.toContain("DialogV2");
  });
});

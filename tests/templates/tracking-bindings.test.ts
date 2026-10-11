import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { identificationInfo } from "../../src/core/tracking";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const FEATURES = read("templates", "actor", "pc", "partials", "pc-feature-panels.hbs");
const CHAT = read("templates", "chat", "ranger-tracking.hbs");
const SHEET = read("src", "sheets", "character", "sheet.ts");
const NPC_SHEET = read("src", "sheets", "npc", "sheet.ts");
const ACTIONS = read("src", "sheets", "character", "tracking-actions.ts");
const CARD = read("src", "core", "tracking", "card.ts");
const RULES = read("src", "core", "tracking", "rules.ts");
const LANG = JSON.parse(read("lang", "en.json")) as Record<string, unknown>;

const lookup = (key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], LANG);
const keysIn = (src: string, re: RegExp): string[] => [...new Set([...src.matchAll(re)].map((m) => m[0]))];

describe("ranger tracking bindings (SP20)", () => {
  it("the Features panel is PC-only, ranger-gated and has one Track button with a single disabled condition", () => {
    expect(FEATURES).toMatch(/@root\.pcActions[\s\S]*@root\.tracking\.visible[\s\S]*data-action="trackQuarry"/);
    const line = FEATURES.split(/\r?\n/).find((l) => l.includes('data-action="trackQuarry"'))!;
    expect(line.match(/disabled/g)).toHaveLength(1);
    expect(line).toContain("tracking.canAct");
  });
  it("the unlocked branch edits the primary terrain and specialization", () => {
    expect(FEATURES).toContain('name="system.tracking.primaryTerrain"');
    expect(FEATURES).toContain('name="system.tracking.specialized"');
  });
  it("the PC sheet registers trackQuarry; the Character NPC sheet sets neither pcActions nor tracking", () => {
    expect(SHEET).toMatch(/^\s+trackQuarry: Adnd2eCharacterSheet\.#on/m);
    expect(NPC_SHEET).not.toMatch(/context\.(pcActions|tracking)\s*=/);
  });
  it("every ADND2E.sheet.tracking key used by the panel and the dialog exists in lang/en.json", () => {
    const used = new Set([...keysIn(FEATURES, /ADND2E\.sheet\.tracking\.[A-Za-z]+/g), ...keysIn(ACTIONS, /ADND2E\.sheet\.tracking\.[A-Za-z]+/g)]);
    expect(used.size).toBeGreaterThan(10);
    for (const key of used) expect(typeof lookup(key), key).toBe("string");
  });
  it("every chat key and rule label key exists in lang/en.json", () => {
    const chat = new Set([...keysIn(CHAT, /ADND2E\.chat\.tracking\.[A-Za-z]+/g), ...keysIn(CARD, /ADND2E\.chat\.tracking\.[A-Za-z]+/g)]);
    expect(chat.size).toBeGreaterThan(0);
    for (const key of chat) expect(typeof lookup(key), key).toBe("string");
    const mods = keysIn(RULES, /ADND2E\.tracking\.mod\.[A-Za-z]+/g);
    expect(mods.length).toBeGreaterThan(5);
    for (const key of mods) expect(typeof lookup(key), key).toBe("string");
    for (const limit of ["quarter", "half", "threeQuarters"]) expect(typeof lookup(`ADND2E.tracking.movement.${limit}`)).toBe("string");
    for (const id of identificationInfo(99)) expect(typeof lookup(`ADND2E.tracking.info.${id}`), id).toBe("string");
  });
  it("the dialog goes through themedPrompt, never DialogV2 directly", () => {
    expect(ACTIONS).toContain("themedPrompt");
    expect(ACTIONS).not.toContain("DialogV2");
  });
});

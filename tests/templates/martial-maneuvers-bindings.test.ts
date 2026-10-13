import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MANEUVERS } from "../../src/core/martial-arts";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const MAIN = read("templates", "actor", "pc", "partials", "pc-main-panels.hbs");
const CHAT = read("templates", "chat", "martial-arts-attack.hbs");
const SHEET = read("src", "sheets", "character", "sheet.ts");
const NPC_SHEET = read("src", "sheets", "npc", "sheet.ts");
const ACTIONS = read("src", "sheets", "character", "martial-arts-actions.ts");
const CARD = read("src", "core", "martial-arts", "card.ts");
const VIEW = read("src", "core", "martial-arts", "view.ts");
const LANG = JSON.parse(read("lang", "en.json")) as Record<string, unknown>;

const lookup = (key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], LANG);
const keysIn = (src: string, re: RegExp): string[] => [...new Set([...src.matchAll(re)].map((m) => m[0]))];

describe("martial arts maneuver bindings (SP18 Plan B1)", () => {
  it("the panel lists maneuvers per style with Learn and Use buttons", () => {
    expect(MAIN).toContain("data-action=\"learnManeuver\"");
    expect(MAIN).toContain("data-action=\"useManeuver\"");
    expect(MAIN).toMatch(/data-maneuver-id="\{\{m\.id\}\}"/);
    const use = MAIN.split(/\r?\n/).find((l) => l.includes('data-action="useManeuver"'))!;
    expect(use.match(/disabled/g)).toHaveLength(1);
    expect(use).toContain("m.usable");
  });
  it("the PC sheet registers both actions; the Character NPC sheet gets neither", () => {
    expect(SHEET).toMatch(/^\s+learnManeuver: Adnd2eCharacterSheet\.#on/m);
    expect(SHEET).toMatch(/^\s+useManeuver: Adnd2eCharacterSheet\.#on/m);
    expect(NPC_SHEET).not.toContain("learnManeuver");
    expect(NPC_SHEET).not.toContain("useManeuver");
  });
  it("a dropped martialStyle is reset to fresh slots and no known maneuvers, and the card notes a missing style die", () => {
    expect(SHEET).toContain("freshStyleUpdate()");
    expect(SHEET).toMatch(/dropped\.type === "martialStyle"\) \{[\s\S]*?freshStyleUpdate\(\)/);
    expect(CHAT).toContain("noStyleDie");
    expect(ACTIONS).toContain("styleDieIsNull");
    expect(ACTIONS).toContain("ADND2E.sheet.martialArts.locked.noLevel");
  });
  it("every sheet, chat and lock-reason key used exists in lang/en.json", () => {
    const keys = new Set([
      ...keysIn(MAIN, /ADND2E\.sheet\.martialArts\.[A-Za-z]+/g),
      ...keysIn(ACTIONS, /ADND2E\.(sheet|chat)\.martialArts\.[A-Za-z.]+/g).filter((k) => !k.endsWith(".")),
      ...keysIn(CHAT, /ADND2E\.chat\.martialArts\.[A-Za-z]+/g),
      ...keysIn(CARD, /ADND2E\.chat\.martialArts\.(?:mod\.)?[A-Za-z0-9]+/g),
      ...["notOffered", "known", "order", "noSlot", "levelCap"].map((r) => `ADND2E.sheet.martialArts.locked.${r}`),
      "ADND2E.sheet.martialArts.maneuvers", "ADND2E.sheet.martialArts.learn", "ADND2E.sheet.martialArts.useManeuver",
      "ADND2E.chat.martialArts.parried", "ADND2E.chat.martialArts.notParried", "ADND2E.chat.martialArts.mod.table21",
    ]);
    for (const key of keys) expect(typeof lookup(key), key).toBe("string");
  });
  it("the view builds lock-reason keys the lang table covers and the registry's costs are labelled", () => {
    expect(VIEW).toContain("ADND2E.sheet.martialArts.locked.");
    for (const m of MANEUVERS) expect(lookup(`ADND2E.martialManeuvers.${m.slug}`), m.slug).toBeTruthy();
  });
  it("the card shows the maneuver line and outcome text, and still reuses applyDamage", () => {
    expect(CHAT).toContain("maneuverKey");
    expect(CHAT).toContain("outcomeKey");
    expect(CHAT).toContain('data-action="applyDamage"');
  });
  it("learning re-validates through the pure rules and writes via the item", () => {
    expect(ACTIONS).toContain("learnability(");
    expect(ACTIONS).toContain("system.knownManeuvers");
    expect(ACTIONS).toContain("system.slotsInvested");
  });
  it("prompts still go through themedPrompt, never DialogV2 directly", () => {
    expect(ACTIONS).toContain("themedPrompt");
    expect(ACTIONS).not.toContain("DialogV2");
  });
  it("the card renders effects with a condition button and a damage button, and the listener is registered", () => {
    expect(CHAT).toContain('data-action="applyCondition"');
    expect(CHAT).toContain("data-condition=");
    expect(CHAT).toContain("data-rounds=");
    expect(CHAT).toContain("effects");
    const LISTENERS = read("src", "chat", "chat-listeners.ts");
    expect(LISTENERS).toContain('[data-action="applyCondition"]');
    expect(LISTENERS).toContain("parseConditionButton");
  });
  it("the panel shows passive maneuvers without a Use button", () => {
    expect(MAIN).toContain("m.kind 'passive'");
    expect(MAIN).toContain("ADND2E.sheet.martialArts.passive");
  });
  it("the new card and sheet keys exist in lang/en.json", () => {
    for (const key of [
      "ADND2E.chat.martialArts.save", "ADND2E.chat.martialArts.saveAt", "ADND2E.chat.martialArts.applyPrefix",
      "ADND2E.chat.martialArts.roundsRoll", "ADND2E.sheet.martialArts.passive",
    ]) expect(typeof lookup(key), key).toBe("string");
  });
});

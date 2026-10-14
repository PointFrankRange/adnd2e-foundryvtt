import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MANEUVERS } from "../../src/core/martial-arts";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const MAIN = read("templates", "actor", "pc", "partials", "pc-main-panels.hbs");
const FEATURES = read("templates", "actor", "pc", "partials", "pc-feature-panels.hbs");
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
  it("Main is the compact play view: known maneuvers with Use, no management controls", () => {
    expect(MAIN).toContain("data-action=\"useManeuver\"");
    expect(MAIN).toContain("s.knownManeuvers");
    expect(MAIN).toContain('title="{{localize m.effectKey}}"');
    expect(MAIN).toMatch(/data-maneuver-id="\{\{m\.id\}\}"/);
    const use = MAIN.split(/\r?\n/).find((l) => l.includes('data-action="useManeuver"'))!;
    expect(use.match(/disabled/g)).toHaveLength(1);
    expect(use).toContain("m.usable");
    for (const gone of ["learnManeuver", "unlearnManeuver", "system.martialArts.knowsBasics", "s.maneuvers"]) expect(MAIN, gone).not.toContain(gone);
  });
  it("Features is the management view: Learn, Unlearn, the full list, no Use or Attack", () => {
    expect(FEATURES).toContain("data-action=\"learnManeuver\"");
    expect(FEATURES).toContain('data-item-id="{{s.id}}"');
    expect(FEATURES).toContain("s.maneuvers");
    expect(FEATURES).toContain("adnd2e.item-controls");
    expect(FEATURES).toContain("ADND2E.sheet.martialArts.manageTitle");
    expect(FEATURES).not.toContain('data-action="useManeuver"');
    expect(FEATURES).not.toContain('data-action="martialArtsAttack"');
    expect(lookup("ADND2E.sheet.martialArts.manageTitle")).toBe("Martial Arts: styles and maneuvers");
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
      ...keysIn(FEATURES, /ADND2E\.sheet\.martialArts\.[A-Za-z]+/g),
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
    expect(FEATURES).toContain("ADND2E.sheet.martialArts.passive");
  });
  it("the new card and sheet keys exist in lang/en.json", () => {
    for (const key of [
      "ADND2E.chat.martialArts.save", "ADND2E.chat.martialArts.saveAt", "ADND2E.chat.martialArts.applyPrefix",
      "ADND2E.chat.martialArts.roundsRoll", "ADND2E.sheet.martialArts.passive",
      "ADND2E.chat.martialArts.whenHoldEnds",
    ]) expect(typeof lookup(key), key).toBe("string");
    expect(CHAT).toContain("e.deferred");
  });
  it("the card renders skill lines, hides the roll for Levitation and shows effects outside the hit block", () => {
    expect(CHAT).toContain("noRoll");
    expect(CHAT).toContain("lines");
    expect(CHAT).toContain("l.key");
    // the effects block follows the hit block's Apply Damage button, so it is not gated on `hit`
    expect(CHAT.indexOf("effects.length")).toBeGreaterThan(CHAT.indexOf('data-action="applyDamage" data-amount="{{damage}}"'));
  });
  it("the panel lists the always-in-effect constants", () => {
    expect(MAIN).toContain("martialArts.constants.summary");
    expect(MAIN).toContain("ADND2E.sheet.martialArts.constants");
  });
  it("use handles skill and utility rows and passes body armor and Blind Fighting through the glue", () => {
    expect(ACTIONS).toContain("resolveLeap");
    expect(ACTIONS).toContain("resolveSpeed");
    expect(ACTIONS).toContain("buildSkillCardContext");
    expect(ACTIONS).toContain("blindFightingTotal");
    expect(ACTIONS).toContain("wearingBodyArmor");
  });
  it("Leap's prone button applies to the speaker (SP18 B3 final review)", () => {
    expect(CHAT).toContain("e.self");
    expect(CHAT).toContain("data-actor-uuid");
    expect(CHAT).toContain("appliesToYou");
    expect(lookup("ADND2E.chat.martialArts.appliesToYou")).toBe("Applies to you.");
    expect(read("src", "chat", "chat-listeners.ts")).toContain("parseSelfActorUuid");
  });
  it("a known passive row shows its own effect text; unlearn is lock-gated and wired (SP18 Plan B3)", () => {
    expect(FEATURES).toContain("m.effectKey");
    const line = FEATURES.split(/\r?\n/).find((l) => l.includes('data-action="unlearnManeuver"'))!;
    expect(line).toContain("@root.adnd2e.lock.unlocked");
    expect(line).not.toContain("disabled");
    expect(SHEET).toMatch(/^\s+unlearnManeuver: Adnd2eCharacterSheet\.#on/m);
    expect(ACTIONS).toContain("unlearnUpdate(");
    expect(ACTIONS).toContain("themedConfirm");
    expect(lookup("ADND2E.sheet.martialArts.unlearn")).toBe("Unlearn");
    expect(lookup("ADND2E.sheet.martialArts.unlearnTitle")).toBe("Unlearn maneuver");
    expect(lookup("ADND2E.sheet.martialArts.unlearnConfirm")).toBe("Unlearn {name}? Its weapon proficiency slot is refunded.");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { castOrBegin } from "../../../src/sheets/character/casting-actions";
import { recoverFromFatigue, resolveMortalFatigue } from "../../../src/sheets/character/fatigue-actions";
import { FATIGUE_CONDITION_ID } from "../../../src/core/magic/channeller-fatigue";
import {
  castFreeMagick,
  castFreeTheurgy,
  castingBlockedByKit,
  learnSpell,
  memorizeFreeMagick,
  castSpell,
  forgetFreeTheurgy,
  memorizeFreeTheurgy,
  memorizeSpell,
  recoverChannellerSp,
  type MemorizedEntry,
  type SpellcasterActor,
  type SpellItemHandle,
} from "../../../src/sheets/character/spell-actions";

// Optional-rule toggles read through game.settings.get(SYSTEM_ID, key).
let rules: Record<string, boolean> = {};
let warn: ReturnType<typeof vi.fn>;

function spellItem(opts: { id: string; name: string; casterClass: string; level: number; spheres: string[]; schools?: string[] }): SpellItemHandle {
  return {
    id: opts.id,
    name: opts.name,
    system: {
      casterClass: opts.casterClass,
      level: opts.level,
      schools: opts.schools ?? [],
      spheres: opts.spheres,
      range: "",
      duration: "",
      castingTime: "",
      savingThrow: "",
      components: { v: true, s: true, m: false },
      automation: { damage: null, healing: null },
    },
  };
}

interface ActorOpts {
  priestChassis?: string | null;
  priestSp?: Record<string, number | undefined>;
  priestChannelling?: { current?: number; max?: number };
  priestFatigueSaveBonus?: number;
  priestMemorized?: SpellcasterActor["system"]["spellcasting"]["priest"]["memorized"];
  priestSlots?: Record<string, { max: number; used: number }>;
  /** XP on the priest class item; the level is derived from it (3000 XP = cleric level 3). */
  priestXp?: number;
  sphereAccessOverride?: string[] | null;
  wizardSp?: Record<string, number | undefined>;
  wizardChannelling?: { current?: number; max?: number };
  wizardSpellbookItemIds?: string[];
  items?: SpellItemHandle[];
}

function makeActor(opts: ActorOpts = {}): SpellcasterActor {
  const classItems = opts.priestChassis === null || opts.priestChassis === undefined
    ? []
    : [{ id: "cls", type: "class", system: { chassisId: opts.priestChassis, xp: opts.priestXp ?? 0 } }];
  const spells = opts.items ?? [];
  const items = Object.assign([...classItems, ...spells], {
    get: (id: string) => spells.find((s) => s.id === id),
  });
  return {
    id: "test-priest",
    name: "Test Priest",
    img: "",
    statuses: new Set<string>(),
    system: {
      abilities: { int: { mods: {} as never } },
      attributes: { hp: { value: 10, max: 10 } },
      saves: { ppd: { target: 12, rollModifier: 0 } },
      spellcasting: {
        wizard: {
          specialistSchool: null,
          memorized: [],
          slots: {},
          spellPoints: opts.wizardSp ?? {},
          channelling: opts.wizardChannelling ?? {},
          fatigueSaveBonus: 0,
          spellbookItemIds: opts.wizardSpellbookItemIds ?? [],
        } as never,
        priest: {
          memorized: opts.priestMemorized ?? [],
          slots: opts.priestSlots ?? { 1: { max: 2, used: 0 } },
          sphereAccessOverride: opts.sphereAccessOverride ?? null,
          spellPoints: opts.priestSp ?? {},
          channelling: opts.priestChannelling ?? {},
          fatigueSaveBonus: opts.priestFatigueSaveBonus ?? 0,
        },
      },
    },
    items: items as never,
    update: vi.fn(async () => undefined),
    toggleStatusEffect: vi.fn(async () => undefined),
  } as unknown as SpellcasterActor;
}

const CLW = spellItem({ id: "clw-id", name: "Cure Light Wounds", casterClass: "priest", level: 1, spheres: ["healing"] });

const affordablePool = { maxSpellLevel: 3, maxPerLevel: 6, sp: 40, spent: 0, remaining: 40 };

beforeEach(() => {
  rules = { spellsAndMagicEnabled: true, spellPoints: true };
  vi.stubGlobal("game", {
    settings: { get: (_system: string, key: string) => rules[key] },
    i18n: {
      localize: (key: string) => key,
      format: (key: string, data: Record<string, unknown>) => `${key}|${String(data.level)}`,
    },
  });
  warn = vi.fn();
  vi.stubGlobal("ui", { notifications: { warn } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("memorizeSpell — priest spell points", () => {
  it("memorizes a priest fixed theurgy when the rule is on and the pool affords it", async () => {
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, items: [CLW] });
    await memorizeSpell(actor, "clw-id");
    expect(actor.update).toHaveBeenCalledWith({
      "system.spellcasting.priest.memorized": [
        { spellItemId: "clw-id", spellLevel: 1, expended: false, magickType: "fixed", theurgyScope: "major" },
      ],
    });
  });

  it("does not consult the classic slot row when the rule is on", async () => {
    // No slots at all: the pool alone decides eligibility.
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, priestSlots: {}, items: [CLW] });
    await memorizeSpell(actor, "clw-id");
    expect(actor.update).toHaveBeenCalledTimes(1);
  });

  it("refuses a priest memorize the pool cannot afford", async () => {
    // Major fixed 1st level costs 4; only 1 SP remains.
    const actor = makeActor({
      priestChassis: "cleric",
      priestSp: { ...affordablePool, spent: 39, remaining: 1 },
      items: [CLW],
    });
    await memorizeSpell(actor, "clw-id");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("refuses a spell the priest's access does not allow at this level", async () => {
    // Elemental is minor-only for a cleric, capped at 3rd level; a 4th-level spell is not memorizable.
    const elemental4 = spellItem({ id: "e4", name: "Elemental 4", casterClass: "priest", level: 4, spheres: ["elemental"] });
    const actor = makeActor({
      priestChassis: "cleric",
      priestSp: { ...affordablePool, maxSpellLevel: 7 },
      items: [elemental4],
    });
    await memorizeSpell(actor, "e4");
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("refuses when the actor has no priest-progression class", async () => {
    const actor = makeActor({ priestChassis: null, priestSp: affordablePool, items: [CLW] });
    await memorizeSpell(actor, "clw-id");
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("keeps the classic priest entry shape and slot check when the rule is off", async () => {
    rules = { spellsAndMagicEnabled: true, spellPoints: false };
    const actor = makeActor({ priestChassis: "cleric", priestSlots: { 1: { max: 2, used: 0 } }, items: [CLW] });
    await memorizeSpell(actor, "clw-id");
    expect(actor.update).toHaveBeenCalledWith({
      "system.spellcasting.priest.memorized": [{ spellItemId: "clw-id", spellLevel: 1, expended: false, magickType: undefined }],
    });
    const written = (actor.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, Array<Record<string, unknown>>>;
    expect(written["system.spellcasting.priest.memorized"][0]).not.toHaveProperty("theurgyScope");
  });

  it("refuses a classic priest memorize with no free slot when the rule is off", async () => {
    rules = { spellsAndMagicEnabled: true, spellPoints: false };
    const actor = makeActor({ priestChassis: "cleric", priestSlots: { 1: { max: 1, used: 1 } }, items: [CLW] });
    await memorizeSpell(actor, "clw-id");
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("leaves the wizard entry shape unchanged (no theurgyScope) when the rule is on", async () => {
    const mageSpell = spellItem({ id: "mage-1", name: "Magic Missile", casterClass: "wizard", level: 1, spheres: [], schools: ["evocation"] });
    const actor = makeActor({
      priestChassis: "cleric",
      wizardSp: { maxSpellLevel: 3, maxPerLevel: 6, sp: 100, spent: 0, remaining: 100 },
      wizardSpellbookItemIds: ["mage-1"],
      items: [mageSpell],
    });
    await memorizeSpell(actor, "mage-1");
    const written = (actor.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, Array<Record<string, unknown>>>;
    const entry = written["system.spellcasting.wizard.memorized"][0];
    expect(entry).toMatchObject({ spellItemId: "mage-1", magickType: "fixed" });
    expect(entry).not.toHaveProperty("theurgyScope");
  });
});

describe("memorizeSpell — priest orisons", () => {
  // A 3rd-level cleric (3000 XP): Table 26 max per level 5, so the orison cap is 10.
  const ORISON = spellItem({ id: "o1", name: "Light", casterClass: "priest", level: 0, spheres: ["all"] });
  const ORISON_CAP_FILL = Array.from({ length: 10 }, (_, i) => ({
    spellItemId: `o${i}`,
    spellLevel: 0,
    expended: false,
    magickType: "fixed" as const,
    theurgyScope: "universal" as const,
  }));
  const orisonPool = { ...affordablePool, spent: 35, remaining: 5, maxPerLevel: 5 };

  it("memorizes an orison at 1 SP under the pool and the 2 x maxPerLevel cap", async () => {
    const actor = makeActor({ priestChassis: "cleric", priestXp: 3000, priestSp: orisonPool, items: [ORISON] });
    await memorizeSpell(actor, "o1");
    expect(actor.update).toHaveBeenCalledWith({
      "system.spellcasting.priest.memorized": [
        { spellItemId: "o1", spellLevel: 0, expended: false, magickType: "fixed", theurgyScope: "universal" },
      ],
    });
  });

  it("refuses an orison once the orison cap is reached", async () => {
    // o11 is not in the ten-entry fill (o0-o9), so the refusal can only come from the cap.
    const ORISON_11 = spellItem({ id: "o11", name: "Light 11", casterClass: "priest", level: 0, spheres: ["all"] });
    const actor = makeActor({
      priestChassis: "cleric",
      priestXp: 3000,
      priestSp: orisonPool,
      priestMemorized: ORISON_CAP_FILL,
      items: [ORISON, ORISON_11],
    });
    await memorizeSpell(actor, "o11");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("refuses an orison when the spell-points rule is off", async () => {
    rules = { spellsAndMagicEnabled: true, spellPoints: false };
    const actor = makeActor({ priestChassis: "cleric", priestXp: 3000, priestSp: orisonPool, items: [ORISON] });
    await memorizeSpell(actor, "o1");
    expect(actor.update).not.toHaveBeenCalled();
  });
});

// The cast dialog filters on the embedded item's document type, which the
// shared spellItem() fixture leaves out; real spell items always carry "spell".
const HEAL3 = { ...spellItem({ id: "heal3", name: "Heal-3", casterClass: "priest", level: 3, spheres: ["healing"] }), type: "spell" } as SpellItemHandle;
const ELEM3 = { ...spellItem({ id: "el3", name: "Elemental-3", casterClass: "priest", level: 3, spheres: ["elemental"] }), type: "spell" } as SpellItemHandle;

describe("memorizeFreeTheurgy — priest free theurgies", () => {
  it("memorizes a major free theurgy at the Table 29 free cost", async () => {
    // priest pool sp 40, spent 0; 3rd level major free costs 20
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, items: [HEAL3] });
    await memorizeFreeTheurgy(actor, 3, "major");
    expect(actor.update).toHaveBeenCalledWith({
      "system.spellcasting.priest.memorized": [
        { spellItemId: null, spellLevel: 3, expended: false, magickType: "free", theurgyScope: "major" },
      ],
    });
  });

  it("memorizes a universal free theurgy at its own Table 29 cost", async () => {
    // 3rd level universal free costs 30, which 40 SP affords
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, items: [HEAL3] });
    await memorizeFreeTheurgy(actor, 3, "universal");
    expect(actor.update).toHaveBeenCalledWith({
      "system.spellcasting.priest.memorized": [
        { spellItemId: null, spellLevel: 3, expended: false, magickType: "free", theurgyScope: "universal" },
      ],
    });
  });

  it("refuses a minor-scope free theurgy (the book allows none)", async () => {
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, items: [HEAL3] });
    await expect(memorizeFreeTheurgy(actor, 3, "minor" as never)).rejects.toThrow(RangeError);
    expect(actor.update).not.toHaveBeenCalled();
  });

  it.each([null, undefined])("refuses a %s scope with the blocked warning and no write (fail closed)", async (scope) => {
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, items: [HEAL3] });
    await memorizeFreeTheurgy(actor, 3, scope as never);
    expect(warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("refuses a free theurgy the pool cannot afford at the free cost", async () => {
    // Major free 3rd level costs 20; only 15 SP remains.
    const actor = makeActor({
      priestChassis: "cleric",
      priestSp: { ...affordablePool, spent: 25, remaining: 15 },
      items: [HEAL3],
    });
    await memorizeFreeTheurgy(actor, 3, "major");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("refuses a major free theurgy when the priest has no major access at that level", async () => {
    // Major access stops at 7th level for a cleric; an 8th-level major free is not allowed.
    const actor = makeActor({
      priestChassis: "cleric",
      priestSp: { maxSpellLevel: 8, maxPerLevel: 6, sp: 999, spent: 0, remaining: 999 },
      items: [HEAL3],
    });
    await memorizeFreeTheurgy(actor, 8, "major");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("refuses a major free theurgy when an empty sphere override grants no major sphere", async () => {
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, sphereAccessOverride: [], items: [HEAL3] });
    await memorizeFreeTheurgy(actor, 3, "major");
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("memorizes a universal free theurgy with no access gate (same empty override)", async () => {
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, sphereAccessOverride: [], items: [HEAL3] });
    await memorizeFreeTheurgy(actor, 3, "universal");
    expect(actor.update).toHaveBeenCalledTimes(1);
  });

  it("refuses when the flat per-level cap is full", async () => {
    const actor = makeActor({
      priestChassis: "cleric",
      priestSp: { maxSpellLevel: 3, maxPerLevel: 1, sp: 40, spent: 0, remaining: 40 },
      priestMemorized: [{ spellItemId: "heal3", spellLevel: 3, expended: false, magickType: "fixed", theurgyScope: "major" }],
      items: [HEAL3],
    });
    await memorizeFreeTheurgy(actor, 3, "major");
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("is a no-op with a warning when the spell-points rule is off", async () => {
    rules = { spellsAndMagicEnabled: true, spellPoints: false };
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, items: [HEAL3] });
    await memorizeFreeTheurgy(actor, 3, "major");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});

// Under the rule a paladin or ranger has no pool: memorizing stays on classic slots.
describe("memorizeSpell / memorizeFreeTheurgy — paladin and ranger under the spell-points rule", () => {
  // Paladin: healing (major). Ranger: animal (major); healing is outside its spheres.
  const ANIMAL1 = spellItem({ id: "ani-1", name: "Animal Friendship", casterClass: "priest", level: 1, spheres: ["animal"] });
  it.each([
    ["paladin", CLW],
    ["ranger", ANIMAL1],
  ])("%s writes a classic entry (no magickType, no theurgyScope) even with an affordable pool", async (chassis, spell) => {
    const actor = makeActor({ priestChassis: chassis, priestSp: affordablePool, priestSlots: { 1: { max: 2, used: 0 } }, items: [spell] });
    await memorizeSpell(actor, spell.id);
    expect(actor.update).toHaveBeenCalledWith({
      "system.spellcasting.priest.memorized": [{ spellItemId: spell.id, spellLevel: 1, expended: false, magickType: undefined }],
    });
    const written = (actor.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, Array<Record<string, unknown>>>;
    expect(written["system.spellcasting.priest.memorized"][0]).not.toHaveProperty("theurgyScope");
    expect(written["system.spellcasting.priest.memorized"][0]!.magickType).toBeUndefined();
  });

  it("refuses a paladin memorize with no free classic slot under the rule", async () => {
    const actor = makeActor({ priestChassis: "paladin", priestSlots: { 1: { max: 1, used: 1 } }, items: [CLW] });
    await memorizeSpell(actor, "clw-id");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("refuses a paladin free theurgy under the rule (free theurgies are pool-only)", async () => {
    const actor = makeActor({ priestChassis: "paladin", priestSp: affordablePool, items: [HEAL3] });
    await memorizeFreeTheurgy(actor, 3, "major");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});

describe("forgetFreeTheurgy — priest free theurgies", () => {
  it("removes only the entry matching its scope and expended state", async () => {
    const major: MemorizedEntry = { spellItemId: null, spellLevel: 3, expended: false, magickType: "free", theurgyScope: "major" };
    const universal: MemorizedEntry = { spellItemId: null, spellLevel: 3, expended: false, magickType: "free", theurgyScope: "universal" };
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, priestMemorized: [major, universal] });
    await forgetFreeTheurgy(actor, 3, "universal", false);
    expect(actor.update).toHaveBeenCalledWith({ "system.spellcasting.priest.memorized": [major] });
  });
});

describe("castFreeTheurgy — priest free theurgies", () => {
  let prompt: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    prompt = vi.fn(async () => "heal3");
    vi.stubGlobal("foundry", {
      applications: {
        api: { DialogV2: { prompt } },
        handlebars: { renderTemplate: vi.fn(async () => "<p>cast</p>") },
      },
      utils: { escapeHTML: (s: string) => s },
    });
    vi.stubGlobal("ChatMessage", { getSpeaker: vi.fn(() => ({})), create: vi.fn(async () => undefined) });
  });

  const freeMajor3: MemorizedEntry = { spellItemId: null, spellLevel: 3, expended: false, magickType: "free", theurgyScope: "major" };

  it("prompts only major-access priest spells for a major free theurgy, then expends the entry", async () => {
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, priestMemorized: [freeMajor3], items: [HEAL3, ELEM3] });
    await castFreeTheurgy(actor, 3, "major");
    const content = (prompt.mock.calls[0] as unknown as [{ content: string }])[0].content;
    expect(content).toContain('value="heal3"');
    expect(content).not.toContain('value="el3"');
    expect(actor.update).toHaveBeenCalledWith({
      "system.spellcasting.priest.memorized": [{ ...freeMajor3, expended: true }],
    });
  });

  it("prompts every priest spell of the level for a universal free theurgy", async () => {
    const universal3: MemorizedEntry = { ...freeMajor3, theurgyScope: "universal" };
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, priestMemorized: [universal3], items: [HEAL3, ELEM3] });
    await castFreeTheurgy(actor, 3, "universal");
    const content = (prompt.mock.calls[0] as unknown as [{ content: string }])[0].content;
    expect(content).toContain('value="heal3"');
    expect(content).toContain('value="el3"');
  });

  it("refuses a chosen spell that is not major-access when casting a major free theurgy", async () => {
    prompt.mockImplementation(async () => "el3");
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, priestMemorized: [freeMajor3], items: [HEAL3, ELEM3] });
    await castFreeTheurgy(actor, 3, "major");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("writes the live list after the prompt and roll, keeping an entry added while the dialog was open", async () => {
    const other: MemorizedEntry = { spellItemId: "clw-id", spellLevel: 1, expended: false, magickType: "fixed", theurgyScope: "major" };
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, priestMemorized: [freeMajor3], items: [HEAL3] });
    prompt.mockImplementation(async () => {
      // a concurrent memorize lands while the dialog is open
      actor.system.spellcasting.priest.memorized = [...actor.system.spellcasting.priest.memorized, other];
      return "heal3";
    });
    await castFreeTheurgy(actor, 3, "major");
    expect(actor.update).toHaveBeenCalledWith({
      "system.spellcasting.priest.memorized": [{ ...freeMajor3, expended: true }, other],
    });
  });

  it("warns the specific no-eligible-spell message and does not prompt when no priest spell qualifies", async () => {
    // Only an elemental 3rd-level spell: minor access for a cleric, so no major free theurgy can use it.
    const actor = makeActor({ priestChassis: "cleric", priestSp: affordablePool, priestMemorized: [freeMajor3], items: [ELEM3] });
    await castFreeTheurgy(actor, 3, "major");
    expect(prompt).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.spells.noEligiblePriestSpell|3");
  });

  it("does not prompt when no unexpended free theurgy of that scope exists", async () => {
    const actor = makeActor({
      priestChassis: "cleric",
      priestSp: affordablePool,
      priestMemorized: [{ ...freeMajor3, expended: true }],
      items: [HEAL3],
    });
    await castFreeTheurgy(actor, 3, "major");
    expect(prompt).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("priest channelling — casts spend the priest pool", () => {
  const CHANNEL_ON = { spellsAndMagicEnabled: true, spellPoints: true, channelers: true };
  const ORISON = spellItem({ id: "o1", name: "Light", casterClass: "priest", level: 0, spheres: ["all"] });
  const clwEntry: MemorizedEntry = { spellItemId: "clw-id", spellLevel: 1, expended: false, magickType: "fixed", theurgyScope: "major" };
  const freeMajor3: MemorizedEntry = { spellItemId: null, spellLevel: 3, expended: false, magickType: "free", theurgyScope: "major" };

  beforeEach(() => {
    rules = { ...CHANNEL_ON };
    vi.stubGlobal("foundry", {
      applications: {
        api: { DialogV2: { prompt: vi.fn(async () => "heal3") } },
        handlebars: { renderTemplate: vi.fn(async () => "<p>cast</p>") },
      },
      utils: { escapeHTML: (s: string) => s },
    });
    vi.stubGlobal("ChatMessage", { getSpeaker: vi.fn(() => ({})), create: vi.fn(async () => undefined) });
  });

  it("spends the priest pool on a channelled cast and writes the priest channelling current", async () => {
    // CLW: priest level 1, fixed, major scope = Table 29 cost 4; 40 - 4 = 36.
    const actor = makeActor({ priestChassis: "cleric", priestChannelling: { current: 40 }, priestMemorized: [clwEntry], items: [CLW] });
    await castSpell(actor, "clw-id");
    expect(actor.update).toHaveBeenCalledWith(
      expect.objectContaining({ "system.spellcasting.priest.channelling.current": 36 }),
    );
    expect(actor.update).toHaveBeenCalledTimes(1);
  });

  it("refuses a channelled cast the priest pool cannot afford", async () => {
    const actor = makeActor({ priestChassis: "cleric", priestChannelling: { current: 3 }, priestMemorized: [clwEntry], items: [CLW] });
    await castSpell(actor, "clw-id");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.spells.castBlockedWarning");
  });

  it("charges one SP for a channelled orison", async () => {
    const orisonEntry: MemorizedEntry = { spellItemId: "o1", spellLevel: 0, expended: false, magickType: "fixed", theurgyScope: "universal" };
    const actor = makeActor({ priestChassis: "cleric", priestChannelling: { current: 40 }, priestMemorized: [orisonEntry], items: [ORISON] });
    await castSpell(actor, "o1");
    expect(actor.update).toHaveBeenCalledWith(
      expect.objectContaining({ "system.spellcasting.priest.channelling.current": 39 }),
    );
  });

  it("casts classically and expends the entry when Channellers is off", async () => {
    rules = { spellsAndMagicEnabled: true, spellPoints: true };
    const actor = makeActor({ priestChassis: "cleric", priestChannelling: { current: 40 }, priestMemorized: [clwEntry], items: [CLW] });
    await castSpell(actor, "clw-id");
    expect(actor.update).toHaveBeenCalledWith({
      "system.spellcasting.priest.memorized": [{ ...clwEntry, expended: true }],
    });
  });

  it("memorizes a theurgy the channelled pool cannot cover, free of SP", async () => {
    const actor = makeActor({
      priestChassis: "cleric",
      priestSp: { ...affordablePool, remaining: 0, spent: 40 },
      priestChannelling: { current: 0 },
      items: [CLW],
    });
    await memorizeSpell(actor, "clw-id");
    expect(actor.update).toHaveBeenCalledWith({
      "system.spellcasting.priest.memorized": [clwEntry],
    });
  });

  it("memorizes a free theurgy the channelled pool cannot cover, free of SP", async () => {
    const actor = makeActor({
      priestChassis: "cleric",
      priestSp: { ...affordablePool, remaining: 0, spent: 40 },
      priestChannelling: { current: 0 },
      items: [HEAL3],
    });
    await memorizeFreeTheurgy(actor, 3, "major");
    expect(actor.update).toHaveBeenCalledWith({
      "system.spellcasting.priest.memorized": [{ ...freeMajor3, spellItemId: null }],
    });
  });

  it("memorizes an orison the channelled pool cannot cover, still under the orison cap", async () => {
    const actor = makeActor({
      priestChassis: "cleric",
      priestXp: 3000,
      priestSp: { ...affordablePool, remaining: 0, spent: 40, maxPerLevel: 5 },
      priestChannelling: { current: 0 },
      items: [ORISON],
    });
    await memorizeSpell(actor, "o1");
    expect(actor.update).toHaveBeenCalledWith({
      "system.spellcasting.priest.memorized": [
        { spellItemId: "o1", spellLevel: 0, expended: false, magickType: "fixed", theurgyScope: "universal" },
      ],
    });
  });

  it("spends the pool on a channelled free theurgy and leaves its entry unexpended", async () => {
    // 3rd-level major free theurgy costs 20; 40 - 20 = 20.
    const actor = makeActor({ priestChassis: "cleric", priestChannelling: { current: 40 }, priestMemorized: [freeMajor3], items: [HEAL3] });
    await castFreeTheurgy(actor, 3, "major");
    expect(actor.update).toHaveBeenCalledTimes(1);
    expect(actor.update).toHaveBeenCalledWith({ "system.spellcasting.priest.channelling.current": 20 });
  });

  it("refuses a channelled free theurgy the pool cannot afford, after the prompt", async () => {
    const actor = makeActor({ priestChassis: "cleric", priestChannelling: { current: 19 }, priestMemorized: [freeMajor3], items: [HEAL3] });
    await castFreeTheurgy(actor, 3, "major");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.spells.castBlockedWarning");
  });
});

describe("castOrBegin and fatigue — priest channelling", () => {
  const CHANNEL_ON = { spellsAndMagicEnabled: true, spellPoints: true, channelers: true, expandedCastingTime: true };
  const clwRounds = { ...CLW, system: { ...CLW.system, castingTime: "1 round" } };
  const clwEntry: MemorizedEntry = { spellItemId: "clw-id", spellLevel: 1, expended: false, magickType: "fixed", theurgyScope: "major" };

  /** A started combat holding the actor: a one-round cast resolves without touching initiative. */
  function stubCombat(): void {
    const combatant = { id: "cbt-1", initiative: 10, update: vi.fn(async () => undefined), unsetFlag: vi.fn(async () => undefined) };
    const combat = {
      id: "combat-1",
      started: true,
      round: 1,
      turn: 0,
      turns: [{ id: "cbt-1" }],
      combatant: { id: "cbt-1" },
      getCombatantsByActor: vi.fn(() => [combatant]),
    };
    vi.stubGlobal("game", {
      settings: { get: (_system: string, key: string) => rules[key] },
      i18n: { localize: (key: string) => key, format: (key: string) => key },
      combats: [combat],
    });
  }

  beforeEach(() => {
    rules = { ...CHANNEL_ON };
    stubCombat();
    vi.stubGlobal("foundry", {
      applications: {
        api: { DialogV2: { prompt: vi.fn(async () => "heal3") } },
        handlebars: { renderTemplate: vi.fn(async () => "<p>cast</p>") },
      },
      utils: { escapeHTML: (s: string) => s },
    });
    vi.stubGlobal("ChatMessage", { getSpeaker: vi.fn(() => ({})), create: vi.fn(async () => undefined) });
  });

  it("an Expanded Casting Time begin spends the priest pool by the Table 29 cost", async () => {
    // CLW major fixed costs 4: 40 - 4 = 36, and the entry stays unexpended while the cast is pending.
    const actor = makeActor({ priestChassis: "cleric", priestChannelling: { current: 40 }, priestMemorized: [clwEntry], items: [clwRounds] });
    await castOrBegin(actor as Parameters<typeof castOrBegin>[0], "clw-id");
    expect(actor.update).toHaveBeenCalledWith(
      expect.objectContaining({ "system.spellcasting.priest.channelling.current": 36 }),
    );
    expect(actor.update).toHaveBeenCalledTimes(1);
  });

  it("an Expanded Casting Time begin the priest pool cannot afford writes nothing", async () => {
    const actor = makeActor({ priestChassis: "cleric", priestChannelling: { current: 3 }, priestMemorized: [clwEntry], items: [clwRounds] });
    await castOrBegin(actor as Parameters<typeof castOrBegin>[0], "clw-id");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.spells.castBlockedWarning");
  });

  it("a channelled priest cast over the fatigue threshold applies a fatigue condition", async () => {
    // A 1st-level cleric's 1st-level spell is heavy fatigue on Table 21, with no HP or SP escalation at full pool.
    rules = { ...CHANNEL_ON, channellerFatigue: true };
    const actor = makeActor({
      priestChassis: "cleric",
      priestChannelling: { current: 40, max: 40 },
      priestMemorized: [clwEntry],
      items: [CLW],
    });
    await castSpell(actor, "clw-id");
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith(FATIGUE_CONDITION_ID.heavy, { active: true });
  });
});

describe("fatigue save bonus — priest banks its own counter", () => {
  const FATIGUED_RULES = {
    spellsAndMagicEnabled: true, spellPoints: true, channelers: true, channellerFatigue: true,
  };
  /** The natural d20 the fake Roll returns: 1 fails the ppd save (target 12), 20 passes. */
  let naturalD20 = 1;

  class FakeRoll {
    formula: string;
    dice: { total: number }[];
    total: number;
    constructor(formula: string) {
      this.formula = formula;
      this.dice = [{ total: naturalD20 }];
      this.total = naturalD20;
    }
    async evaluate(): Promise<this> {
      return this;
    }
    async toMessage(): Promise<void> {
      return undefined;
    }
  }

  beforeEach(() => {
    rules = { ...FATIGUED_RULES };
    vi.stubGlobal("Roll", FakeRoll);
    vi.stubGlobal("foundry", {
      applications: { handlebars: { renderTemplate: vi.fn(async () => "<p>save</p>") } },
    });
    vi.stubGlobal("ChatMessage", { getSpeaker: vi.fn(() => ({})), create: vi.fn(async () => undefined) });
    vi.stubGlobal("ui", { notifications: { warn, info: vi.fn() } });
  });

  it("a priest-only channeller's failed recover roll increments the priest counter, not the wizard's", async () => {
    naturalD20 = 1;
    const actor = makeActor({
      priestChassis: "cleric",
      priestChannelling: { current: 40, max: 40 },
      priestFatigueSaveBonus: 2,
    });
    actor.statuses = new Set([FATIGUE_CONDITION_ID.heavy]);
    await recoverFromFatigue(actor);
    expect(actor.update).toHaveBeenCalledTimes(1);
    expect(actor.update).toHaveBeenCalledWith({ "system.spellcasting.priest.fatigueSaveBonus": 3 });
  });

  it("a priest-only channeller's passed recover roll clears the priest counter and drops one tier", async () => {
    naturalD20 = 20;
    const actor = makeActor({
      priestChassis: "cleric",
      priestChannelling: { current: 40, max: 40 },
      priestFatigueSaveBonus: 2,
    });
    actor.statuses = new Set([FATIGUE_CONDITION_ID.heavy]);
    await recoverFromFatigue(actor);
    expect(actor.update).toHaveBeenCalledWith({ "system.spellcasting.priest.fatigueSaveBonus": 0 });
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith(FATIGUE_CONDITION_ID.heavy, { active: false });
  });

  it("a wizard's failed recover roll still increments the wizard counter", async () => {
    naturalD20 = 1;
    const actor = makeActor({});
    actor.statuses = new Set([FATIGUE_CONDITION_ID.heavy]);
    await recoverFromFatigue(actor);
    expect(actor.update).toHaveBeenCalledWith({ "system.spellcasting.wizard.fatigueSaveBonus": 1 });
  });

  it("a priest's mortal-tier resolution writes neither counter (the mortal save carries no bonus)", async () => {
    naturalD20 = 1;
    const actor = makeActor({ priestChassis: "cleric", priestChannelling: { current: 40, max: 40 }, priestFatigueSaveBonus: 2 });
    await resolveMortalFatigue(actor);
    expect(actor.update).toHaveBeenCalledWith({ "system.attributes.hp.value": 0 });
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith("dead", { active: true });
    expect(JSON.stringify((actor.update as ReturnType<typeof vi.fn>).mock.calls)).not.toContain("fatigueSaveBonus");
  });
});

describe("recoverChannellerSp — priest and wizard pools", () => {
  const CHANNEL_ON = { spellsAndMagicEnabled: true, spellPoints: true, channelers: true };

  it("recovers the priest pool under Table 20 and writes the priest current", async () => {
    rules = CHANNEL_ON;
    const actor = makeActor({ priestChannelling: { current: 10, max: 61 } });
    await recoverChannellerSp(actor, "priest", "sleeping", 8);
    expect(actor.update).toHaveBeenCalledWith({ "system.spellcasting.priest.channelling.current": 61 });
  });

  it("recovers the wizard pool and writes the wizard current", async () => {
    rules = CHANNEL_ON;
    const actor = makeActor({ wizardChannelling: { current: 10, max: 61 } });
    await recoverChannellerSp(actor, "wizard", "sleeping", 8);
    expect(actor.update).toHaveBeenCalledWith({ "system.spellcasting.wizard.channelling.current": 61 });
  });

  it("is a no-op with a warning when Channellers is off", async () => {
    const actor = makeActor({ priestChannelling: { current: 10, max: 61 } });
    await recoverChannellerSp(actor, "priest", "sleeping", 8);
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.spells.channellingBlockedWarning");
  });
});

describe("kit-disabled casting (SP11 Plan C)", () => {
  const kit = (casting: string) => ({
    id: "k1", name: "Kit", type: "kit",
    system: {
      chassisId: "paladin",
      qualifications: { abilityMinimums: {}, races: [], alignments: [] },
      xpModifierPercent: 0,
      effects: [],
      equipment: { armor: { mode: "inherit", names: [] }, weapons: { mode: "inherit", names: [] } },
      forbiddenWeaponProficiencies: [],
      grantedFeatures: [],
      powers: [],
      overrides: { casting, turning: { mode: "inherit", offset: 0 }, removedAbilities: [] },
    },
  });
  const paladinActor = (casting: string, memorized: SpellcasterActor["system"]["spellcasting"]["priest"]["memorized"] = []) => {
    const actor = makeActor({ priestChassis: "paladin", priestXp: 3000, items: [CLW], priestMemorized: memorized });
    // append the paladin's kit beside its class and spell items (makeActor builds `items` as an array with a `get`)
    (actor.items as unknown as unknown[]).push(kit(casting));
    return actor;
  };

  it("memorizeSpell, castSpell, learnSpell and castOrBegin are blocked with a toast and no write when the kit casting is none", async () => {
    const mem = [{ spellItemId: "clw-id", spellLevel: 1, expended: false, magickType: "fixed" as const }];
    const actor = paladinActor("none", mem);
    await memorizeSpell(actor, "clw-id");
    await castSpell(actor, "clw-id");
    await learnSpell(actor, "clw-id");
    await castOrBegin(actor as never, "clw-id");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.spells.kitCastingDisabledWarning");
  });

  it("the free magick and free theurgy actions are blocked too", async () => {
    const actor = paladinActor("none");
    await memorizeFreeMagick(actor, 1);
    await castFreeMagick(actor, 1, "clw-id");
    await memorizeFreeTheurgy(actor, 1, "major");
    await castFreeTheurgy(actor, 1, "major");
    expect(actor.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.spells.kitCastingDisabledWarning");
  });

  it("the same calls work with the kit's casting inherit", async () => {
    const actor = paladinActor("inherit");
    await memorizeSpell(actor, "clw-id");
    expect(warn).not.toHaveBeenCalledWith("ADND2E.sheet.spells.kitCastingDisabledWarning");
    expect(actor.update).toHaveBeenCalledTimes(1);
  });

  it("castingBlockedByKit reports the priest side blocked and the wizard side not", () => {
    const actor = paladinActor("none");
    expect(castingBlockedByKit(actor, "priest")).toBe(true);
    expect(castingBlockedByKit(actor, "wizard")).toBe(false);
    expect(castingBlockedByKit(paladinActor("inherit"), "priest")).toBe(false);
  });
});

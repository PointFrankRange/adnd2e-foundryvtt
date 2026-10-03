import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memorizeSpell, type SpellcasterActor, type SpellItemHandle } from "../../../src/sheets/character/spell-actions";

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
  priestMemorized?: SpellcasterActor["system"]["spellcasting"]["priest"]["memorized"];
  priestSlots?: Record<string, { max: number; used: number }>;
  sphereAccessOverride?: string[] | null;
  wizardSp?: Record<string, number | undefined>;
  wizardSpellbookItemIds?: string[];
  items?: SpellItemHandle[];
}

function makeActor(opts: ActorOpts = {}): SpellcasterActor {
  const classItems = opts.priestChassis === null || opts.priestChassis === undefined
    ? []
    : [{ id: "cls", type: "class", system: { chassisId: opts.priestChassis, xp: 0 } }];
  const spells = opts.items ?? [];
  const items = Object.assign([...classItems, ...spells], {
    get: (id: string) => spells.find((s) => s.id === id),
  });
  return {
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
          channelling: {},
          fatigueSaveBonus: 0,
          spellbookItemIds: opts.wizardSpellbookItemIds ?? [],
        } as never,
        priest: {
          memorized: opts.priestMemorized ?? [],
          slots: opts.priestSlots ?? { 1: { max: 2, used: 0 } },
          sphereAccessOverride: opts.sphereAccessOverride ?? null,
          spellPoints: opts.priestSp ?? {},
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
    i18n: { localize: (key: string) => key },
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

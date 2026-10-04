import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import { buildCharacterSheetContext } from "../../../src/sheets/character/context";
import type {
  CastingStatusInput,
  CharacterSheetInput,
  FeatureItemView,
  NwpView,
  PhysicalItemView,
  SpellItemView,
  TraitItemView,
  WeaponProfView,
} from "../../../src/sheets/character/context-types";
import type { RawTraitEffect } from "../../../src/core/skills/traits";

// fixture factory — a single-class L7 fighter, human, no items
function input(over: Partial<CharacterSheetInput> = {}): CharacterSheetInput {
  const base: CharacterSheetInput = {
    name: "Aldric",
    img: "icons/svg/mystery-man.svg",
    source: {
      system: {
        abilities: {
          str: { score: 17, exceptional: null },
          dex: { score: 12, exceptional: null },
          con: { score: 15, exceptional: null },
          int: { score: 10, exceptional: null },
          wis: { score: 9, exceptional: null },
          cha: { score: 13, exceptional: null },
        },
        details: {
          alignment: "true-neutral",
          age: 25,
          sex: "",
          height: "",
          weight: "",
          hairEyes: "",
          homeland: "",
          deity: "",
          kit: "",
        },
        currency: { pp: 0, gp: 42, ep: 0, sp: 0, cp: 0 },
        resources: { reputation: "", henchmen: "", followers: "" },
      },
    },
    derived: {
      abilities: {
        str: {
          score: 17,
          mods: {
            hitProb: 1,
            damageAdj: 1,
            weightAllowance: 85,
            maxPress: 220,
            openDoors: 11,
            openDoorsMagical: null,
            bendBarsLiftGates: 13,
          } as never,
        },
        dex: { score: 12, mods: { reactionAdj: 0, missileAttackAdj: 0, defensiveAdj: 0 } as never },
        con: {
          score: 15,
          mods: {
            hpAdjustment: 1,
            systemShock: 90,
            resurrectionSurvival: 94,
            poisonSave: 0,
            regeneration: "",
            hitDieMinimumRoll: 1,
          } as never,
        },
        int: { score: 10, mods: {} as never },
        wis: { score: 9, mods: {} as never },
        cha: { score: 13, mods: {} as never },
      },
      classes: [{ chassisId: "fighter", level: 7, canLevelUp: false }],
      multiclass: {
        mode: "single",
        dualClass: { dormantChassisId: null, activeChassisId: null, surpassed: false },
        hpAveraged: false,
      },
      attributes: {
        hp: { value: 52, max: 52, temp: 0, nonlethal: 0 },
        thac0: { base: 14, melee: 13, ranged: 14 },
        ac: { normal: 10, rearAttack: 10, surprised: 10, shieldless: 10 },
        movement: { base: 12, current: 12, encumbranceCategory: "unencumbered" },
        encumbrance: {
          carried: 0,
          category: "unencumbered",
          movementRate: 12,
          penalty: { attackRoll: 0, armorClass: 0 },
          baseMove: 12,
        },
      },
      saves: {
        ppd: { target: 12, rollModifier: 0, effectiveTarget: 12 },
        rsw: { target: 13, rollModifier: 0, effectiveTarget: 13 },
        pp: { target: 14, rollModifier: 0, effectiveTarget: 14 },
        bw: { target: 15, rollModifier: 0, effectiveTarget: 15 },
        spell: { target: 16, rollModifier: 0, effectiveTarget: 16 },
      },
      spellcasting: {
        wizard: { specialistSchool: null, slots: {}, memorized: [] },
        priest: { slots: {}, memorized: [], sphereAccessOverride: null },
      },
      proficiencies: {
        weapon: { total: 4, spent: 0, available: 4 },
        nonweapon: { total: 3, spent: 0, available: 3 },
      },
      thiefSkills: { total: 0, spent: 0, available: 0 },
      languagesKnown: { max: 2 },
    },
    classItems: [
      {
        id: "c1",
        name: "Fighter",
        img: "",
        chassisId: "fighter",
        hitDie: 10,
        xp: 70000,
        level: 7,
        canLevelUp: false,
        dualClassState: null,
        specialistSchool: null,
      },
    ],
    raceItem: null,
    physicalItems: [],
    proficiencyItems: { weapon: [], nonweapon: [] },
    thiefSkillAllocations: [],
    spellItems: [],
    featureItems: [],
    config: {
      abilities: {
        str: "ADND2E.abilities.str",
        dex: "ADND2E.abilities.dex",
        con: "ADND2E.abilities.con",
        int: "ADND2E.abilities.int",
        wis: "ADND2E.abilities.wis",
        cha: "ADND2E.abilities.cha",
      },
      saves: {
        ppd: "ADND2E.saves.ppd",
        rsw: "ADND2E.saves.rsw",
        pp: "ADND2E.saves.pp",
        bw: "ADND2E.saves.bw",
        spell: "ADND2E.saves.spell",
      },
      alignments: { "true-neutral": "ADND2E.alignments.true-neutral" },
      encumbranceCategories: { unencumbered: "ADND2E.encumbranceCategories.unencumbered" },
      classGroups: {},
      schools: {},
      spheres: {},
    },
    perms: { isGM: true, isOwner: true, editable: true },
    optionalRules: DEFAULT_OPTIONAL_RULES,
  };
  return { ...base, ...over };
}

function physItem(over: Partial<PhysicalItemView> = {}): PhysicalItemView {
  return {
    id: "p1",
    name: "Thing",
    img: "",
    type: "equipment",
    quantity: 1,
    weight: 1,
    totalWeight: 1,
    location: "",
    equipped: false,
    identified: true,
    magicBonus: 0,
    isContainer: false,
    capacity: null,
    contentsWeightMultiplier: 1,
    ...over,
  };
}

/* ------------------------------------------------------------------ identity */

describe("buildCharacterSheetContext — identity", () => {
  it("single-class line, no badge", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.identity.classLine).toBe("Fighter 7");
    expect(c.identity.arrangementBadge).toBeNull();
    expect(c.identity.raceName).toBeNull();
    expect(c.identity.raceItemId).toBeNull();
    expect(c.identity.name).toBe("Aldric");
    expect(c.identity.alignmentValue).toBe("true-neutral");
  });

  it("multiclass line + badge", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          classes: [
            { chassisId: "fighter", level: 7, canLevelUp: false },
            { chassisId: "mage", level: 6, canLevelUp: false },
          ],
          multiclass: {
            mode: "multiclass",
            dualClass: { dormantChassisId: null, activeChassisId: null, surpassed: false },
            hpAveraged: true,
          },
        },
        classItems: [
          {
            id: "c1",
            name: "Fighter",
            img: "",
            chassisId: "fighter",
            hitDie: 10,
            xp: 70000,
            level: 7,
            canLevelUp: false,
            dualClassState: null,
            specialistSchool: null,
          },
          {
            id: "c2",
            name: "Mage",
            img: "",
            chassisId: "mage",
            hitDie: 4,
            xp: 40000,
            level: 6,
            canLevelUp: false,
            dualClassState: null,
            specialistSchool: null,
          },
        ],
      }),
    );
    expect(c.identity.classLine).toBe("Fighter 7 / Mage 6");
    expect(c.identity.arrangementBadge).toBe("multi-class");
  });

  it("dual-class line + badge (dormant)", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          multiclass: {
            mode: "dualclass",
            dualClass: { dormantChassisId: "fighter", activeChassisId: "mage", surpassed: false },
            hpAveraged: false,
          },
        },
        classItems: [
          {
            id: "c1",
            name: "Fighter",
            img: "",
            chassisId: "fighter",
            hitDie: 10,
            xp: 70000,
            level: 7,
            canLevelUp: false,
            dualClassState: "primary",
            specialistSchool: null,
          },
          {
            id: "c2",
            name: "Mage",
            img: "",
            chassisId: "mage",
            hitDie: 4,
            xp: 20000,
            level: 5,
            canLevelUp: true,
            dualClassState: "active",
            specialistSchool: null,
          },
        ],
      }),
    );
    expect(c.identity.classLine).toBe("Fighter 7 → Mage 5");
    expect(c.identity.arrangementBadge).toBe("dual-class · Fighter dormant");
    expect(c.classes[0].isDualPrimary).toBe(true);
    expect(c.classes[1].isDualActive).toBe(true);
    expect(c.dualClassToggle).toEqual({ available: false, on: true });
  });

  it("dual-class badge shows 'surpassed' once the new class passes the old", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          multiclass: {
            mode: "dualclass",
            dualClass: { dormantChassisId: "thief", activeChassisId: "mage", surpassed: true },
            hpAveraged: false,
          },
        },
        classItems: [
          {
            id: "c1",
            name: "Thief",
            img: "",
            chassisId: "thief",
            hitDie: 6,
            xp: 40000,
            level: 8,
            canLevelUp: false,
            dualClassState: "primary",
            specialistSchool: null,
          },
          {
            id: "c2",
            name: "Mage",
            img: "",
            chassisId: "mage",
            hitDie: 4,
            xp: 135000,
            level: 9,
            canLevelUp: false,
            dualClassState: "active",
            specialistSchool: null,
          },
        ],
      }),
    );
    expect(c.identity.arrangementBadge).toBe("dual-class · Thief surpassed");
  });

  it("an empty dormant-class id still yields a (degenerate) badge", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          multiclass: {
            mode: "dualclass",
            dualClass: { dormantChassisId: "", activeChassisId: "mage", surpassed: false },
            hpAveraged: false,
          },
        },
        classItems: [
          {
            id: "c1",
            name: "Fighter",
            img: "",
            chassisId: "fighter",
            hitDie: 10,
            xp: 70000,
            level: 7,
            canLevelUp: false,
            dualClassState: "primary",
            specialistSchool: null,
          },
          {
            id: "c2",
            name: "Mage",
            img: "",
            chassisId: "mage",
            hitDie: 4,
            xp: 20000,
            level: 5,
            canLevelUp: true,
            dualClassState: "active",
            specialistSchool: null,
          },
        ],
      }),
    );
    expect(c.identity.arrangementBadge).toBe("dual-class ·  dormant");
  });

  it("race name + racial abilities come from the race item", () => {
    const c = buildCharacterSheetContext(
      input({
        raceItem: {
          id: "r1",
          name: "Elf",
          img: "",
          raceId: "elf",
          size: "M",
          baseMovement: 12,
          infravision: 60,
          grantedFeatures: ["infravision-60", "resist-sleep-charm"],
          bonusLanguages: ["elvish"],
        },
      }),
    );
    expect(c.identity.raceName).toBe("Elf");
    expect(c.identity.raceItemId).toBe("r1");
    expect(c.features.racialAbilities).toEqual(["infravision-60", "resist-sleep-charm"]);
  });
});

/* ----------------------------------------------------------------- abilities */

describe("buildCharacterSheetContext — abilities", () => {
  it("six rows, racial delta from source vs derived", () => {
    const c = buildCharacterSheetContext(
      input({
        // dwarf: con +1 (racial-adjustments.ts) — matches the derived.con.score
        // override below exactly, so the whole delta is attributed to race.
        raceItem: {
          id: "r1", name: "Dwarf", img: "", raceId: "dwarf", size: "M",
          baseMovement: 12, infravision: 60, grantedFeatures: [], bonusLanguages: [],
        },
        derived: {
          ...input().derived,
          abilities: {
            ...input().derived.abilities,
            con: { score: 16, mods: input().derived.abilities.con.mods },
          },
        },
      }),
    );
    expect(c.abilities).toHaveLength(6);
    const con = c.abilities.find((a) => a.key === "con")!;
    expect(con.score).toBe(15);
    expect(con.effectiveScore).toBe(16);
    expect(con.racialDelta).toBe(1);
    expect(con.traitDelta).toBe(0);
    expect(con.label).toBe("ADND2E.abilities.con");
    expect(con.mods.some((m) => m.label === "Hp Adjustment" && m.value === "1")).toBe(true);
  });

  it("a trait's ability bonus shows as traitDelta, not racialDelta — and now correctly shows the exceptional-Strength input", () => {
    // No race override (defaults to human, zero racial deltas) — authored STR
    // 17, effective 18 entirely from a trait (e.g. the "Powerful" trait's +1
    // STR). Backlog bug: this used to show neither a distinct trait badge nor
    // the percentile input, because both were gated on the PRE-trait score.
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          abilities: {
            ...input().derived.abilities,
            str: { score: 18, mods: input().derived.abilities.str.mods },
          },
        },
      }),
    );
    const str = c.abilities.find((a) => a.key === "str")!;
    expect(str.score).toBe(17);
    expect(str.effectiveScore).toBe(18);
    expect(str.racialDelta).toBe(0);
    expect(str.traitDelta).toBe(1);
    expect(str.showExceptional).toBe(true);
  });

  it("racial and trait deltas combine additively when both apply", () => {
    const c = buildCharacterSheetContext(
      input({
        raceItem: {
          id: "r1", name: "Dwarf", img: "", raceId: "dwarf", size: "M",
          baseMovement: 12, infravision: 60, grantedFeatures: [], bonusLanguages: [],
        },
        derived: {
          ...input().derived,
          abilities: {
            ...input().derived.abilities,
            // authored con 15 -> +1 racial (dwarf) -> +1 trait -> 17
            con: { score: 17, mods: input().derived.abilities.con.mods },
          },
        },
      }),
    );
    const con = c.abilities.find((a) => a.key === "con")!;
    expect(con.racialDelta).toBe(1);
    expect(con.traitDelta).toBe(1);
    expect(con.effectiveScore).toBe(17);
  });

  it("null modifier values render as an em dash", () => {
    const str = buildCharacterSheetContext(input()).abilities.find((a) => a.key === "str")!;
    expect(str.mods.some((m) => m.label === "Open Doors Magical" && m.value === "—")).toBe(true);
  });

  it("exceptional field shows only for an 18 STR", () => {
    expect(
      buildCharacterSheetContext(input()).abilities.find((a) => a.key === "str")!.showExceptional,
    ).toBe(false);
  });

  it("exceptional field shows (and carries the percentile) for an 18 STR", () => {
    const src = input().source as { system: { abilities: Record<string, unknown> } };
    src.system.abilities.str = { score: 18, exceptional: 91 };
    const c = buildCharacterSheetContext(
      input({
        source: src as never,
        derived: {
          ...input().derived,
          abilities: {
            ...input().derived.abilities,
            str: { score: 18, mods: input().derived.abilities.str.mods },
          },
        },
      }),
    );
    const str = c.abilities.find((a) => a.key === "str")!;
    expect(str.showExceptional).toBe(true);
    expect(str.exceptional).toBe(91);
  });
});

/* ------------------------------------------- vitals / classes / dual toggle */

describe("buildCharacterSheetContext — vitals / classes / dual-class toggle", () => {
  it("five save rows with labels", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.vitals.saves.map((s) => s.key)).toEqual(["ppd", "rsw", "pp", "bw", "spell"]);
    expect(c.vitals.saves[0].effectiveTarget).toBe(12);
    expect(c.vitals.saves[0].label).toBe("ADND2E.saves.ppd");
    expect(c.vitals.saves[0].shortLabel).toBe("ADND2E.sheet.saves.short.ppd");
    expect(c.vitals.saves.map((s) => s.shortLabel)).toEqual([
      "ADND2E.sheet.saves.short.ppd", "ADND2E.sheet.saves.short.rsw", "ADND2E.sheet.saves.short.pp",
      "ADND2E.sheet.saves.short.bw", "ADND2E.sheet.saves.short.spell",
    ]);
  });

  it("movement carries the localised encumbrance-category label", () => {
    const m = buildCharacterSheetContext(input()).vitals.movement;
    expect(m.encumbranceCategory).toBe("unencumbered");
    expect(m.encumbranceCategoryLabel).toBe("ADND2E.encumbranceCategories.unencumbered");
  });

  it("class row carries xp progress", () => {
    const row = buildCharacterSheetContext(input()).classes[0];
    expect(row.level).toBe(7);
    expect(row.canLevelUp).toBe(false);
    expect(row.nextThreshold).toBe(125000);
    expect(row.xpToNextLevel).toBe(55000);
    expect(row.xpPct).toBeGreaterThan(0);
    expect(row.isDualPrimary).toBe(false);
    expect(row.isDualActive).toBe(false);
  });

  it("dual-class toggle unavailable for a single class", () => {
    expect(buildCharacterSheetContext(input()).dualClassToggle).toEqual({
      available: false,
      on: false,
    });
  });

  it("dual-class toggle available for exactly two un-paired classes", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [
          {
            id: "c1",
            name: "Fighter",
            img: "",
            chassisId: "fighter",
            hitDie: 10,
            xp: 70000,
            level: 7,
            canLevelUp: false,
            dualClassState: null,
            specialistSchool: null,
          },
          {
            id: "c2",
            name: "Thief",
            img: "",
            chassisId: "thief",
            hitDie: 6,
            xp: 10000,
            level: 5,
            canLevelUp: false,
            dualClassState: null,
            specialistSchool: null,
          },
        ],
      }),
    );
    expect(c.dualClassToggle).toEqual({ available: true, on: false });
  });
});

/* -------------------------------------------- inventory / combat / skills */

describe("buildCharacterSheetContext — inventory / combat / skills", () => {
  it("currency passes through; loose vs container split", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.inventory.currency.gp).toBe(42);
    expect(c.inventory.containers).toHaveLength(0);
    expect(c.inventory.loose).toHaveLength(0);
    expect(c.inventory.locationOptions).toEqual([
      { value: "", label: "ADND2E.sheet.inventory.noContainer" },
    ]);
    expect(c.inventory.encumbrance.categoryLabel).toBe(
      "ADND2E.encumbranceCategories.unencumbered",
    );
  });

  it("a container yields a group + a location option", () => {
    const c = buildCharacterSheetContext(
      input({
        physicalItems: [
          physItem({ id: "sack", name: "Sack", isContainer: true, capacity: 30 }),
          physItem({ id: "torch", name: "Torch", location: "sack", totalWeight: 1 }),
          physItem({ id: "loose", name: "Rope", location: "" }),
        ],
      }),
    );
    expect(c.inventory.containers).toHaveLength(1);
    expect(c.inventory.containers[0].contents.map((i) => i.id)).toEqual(["torch"]);
    expect(c.inventory.loose.map((i) => i.id)).toEqual(["loose"]);
    expect(c.inventory.locationOptions).toEqual([
      { value: "", label: "ADND2E.sheet.inventory.noContainer" },
      { value: "sack", label: "Sack" },
    ]);
  });

  it("weapons become display rows; damageNote joins the two damage strings", () => {
    const c = buildCharacterSheetContext(
      input({
        physicalItems: [
          physItem({
            id: "w1",
            name: "Long Sword",
            type: "weapon",
            equipped: true,
            weapon: { damageVsSM: "1d8", damageVsL: "1d12", speedFactor: 5, range: null, category: "melee", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: "slashing", ammoType: null, selectedAmmoId: null },
          }),
          physItem({
            id: "w2",
            name: "Dagger",
            type: "weapon",
            weapon: { damageVsSM: "1d4", damageVsL: null, speedFactor: 2, range: "10/20/30", category: "melee", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: "piercing", ammoType: null, selectedAmmoId: null },
          }),
        ],
      }),
    );
    expect(c.combat.weapons).toEqual([
      {
        id: "w1",
        name: "Long Sword",
        equipped: true,
        toHitNote: "",
        damageNote: "1d8 / 1d12",
        speedFactor: 5,
        range: null,
        canBackstab: false,
        favorite: false,
        ammoType: null,
        ammoOptions: [],
        grandMasteryExtraAttack: false,
        specialistAttackRate: null,
      },
      {
        id: "w2",
        name: "Dagger",
        equipped: false,
        toHitNote: "",
        damageNote: "1d4",
        speedFactor: 2,
        range: "10/20/30",
        canBackstab: false,
        favorite: false,
        ammoType: null,
        ammoOptions: [],
        grandMasteryExtraAttack: false,
        specialistAttackRate: null,
      },
    ]);
  });

  it("a bow's ammo select lists matching, in-stock ammo and defaults to the first match", () => {
    const c = buildCharacterSheetContext(
      input({
        physicalItems: [
          physItem({
            id: "bow1", name: "Short Bow", type: "weapon", equipped: true,
            weapon: {
              damageVsSM: null, damageVsL: null, speedFactor: 7, range: "50/100/150", category: "bow", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: null,
              ammoType: "arrow", selectedAmmoId: null,
            },
          }),
          physItem({
            id: "ammo1", name: "Arrow", type: "ammo", quantity: 12,
            ammo: { ammoType: "arrow", damageVsSM: "1d6", damageVsL: "1d6", damageType: "piercing" },
          }),
          physItem({
            id: "ammo2", name: "Bolt", type: "ammo", quantity: 5,
            ammo: { ammoType: "bolt", damageVsSM: "1d4", damageVsL: "1d4", damageType: "piercing" },
          }),
        ],
      }),
    );
    const bowRow = c.combat.weapons.find((w) => w.id === "bow1")!;
    expect(bowRow.ammoType).toBe("arrow");
    expect(bowRow.ammoOptions).toEqual([{ value: "ammo1", label: "Arrow (12)", selected: true }]);
    expect(bowRow.damageNote).toBe("1d6 / 1d6");
  });

  it("keeps a persisted selectedAmmoId as the default when it's still a valid candidate", () => {
    const c = buildCharacterSheetContext(
      input({
        physicalItems: [
          physItem({
            id: "bow1", name: "Short Bow", type: "weapon", equipped: true,
            weapon: {
              damageVsSM: null, damageVsL: null, speedFactor: 7, range: "50/100/150", category: "bow", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: null,
              ammoType: "arrow", selectedAmmoId: "ammo2",
            },
          }),
          physItem({
            id: "ammo1", name: "Arrow", type: "ammo", quantity: 12,
            ammo: { ammoType: "arrow", damageVsSM: "1d6", damageVsL: "1d6", damageType: "piercing" },
          }),
          physItem({
            id: "ammo2", name: "Flight Arrow", type: "ammo", quantity: 4,
            ammo: { ammoType: "arrow", damageVsSM: "1d6", damageVsL: "1d6", damageType: "piercing" },
          }),
        ],
      }),
    );
    const bowRow = c.combat.weapons.find((w) => w.id === "bow1")!;
    expect(bowRow.ammoOptions.map((o) => o.value)).toEqual(["ammo1", "ammo2"]);
    expect(bowRow.ammoOptions.find((o) => o.value === "ammo2")!.selected).toBe(true);
    expect(bowRow.ammoOptions.find((o) => o.value === "ammo1")!.selected).toBe(false);
  });

  it("excludes out-of-stock ammo from the options; damageNote is blank with none in stock", () => {
    const c = buildCharacterSheetContext(
      input({
        physicalItems: [
          physItem({
            id: "bow1", name: "Short Bow", type: "weapon", equipped: true,
            weapon: {
              damageVsSM: null, damageVsL: null, speedFactor: 7, range: "50/100/150", category: "bow", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: null,
              ammoType: "arrow", selectedAmmoId: null,
            },
          }),
          physItem({
            id: "ammo1", name: "Arrow", type: "ammo", quantity: 0,
            ammo: { ammoType: "arrow", damageVsSM: "1d6", damageVsL: "1d6", damageType: "piercing" },
          }),
        ],
      }),
    );
    const bowRow = c.combat.weapons.find((w) => w.id === "bow1")!;
    expect(bowRow.ammoOptions).toEqual([]);
    expect(bowRow.damageNote).toBe("");
  });

  it("no armor → AC breakdown falls back to base 10 / no shield", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.combat.acBreakdown).toEqual([
      { label: "ADND2E.sheet.combat.acBase", value: 10 },
      { label: "ADND2E.sheet.combat.acShield", value: 0 },
      { label: "ADND2E.sheet.combat.acMagic", value: 0 },
      { label: "ADND2E.sheet.combat.acDex", value: 0 },
    ]);
    expect(c.combat.armor).toHaveLength(0);
  });

  it("equipped armor + shield feed the AC breakdown and armor list", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          abilities: {
            ...input().derived.abilities,
            dex: {
              score: 16,
              mods: { reactionAdj: 0, missileAttackAdj: 1, defensiveAdj: -2 } as never,
            },
          },
        },
        physicalItems: [
          physItem({
            id: "a1",
            name: "Plate Mail",
            type: "armor",
            equipped: true,
            magicBonus: 1,
            armor: { baseAc: 3, isShield: false, shieldAcBonus: 0, armorType: "leather" },
          }),
          physItem({
            id: "s1",
            name: "Medium Shield",
            type: "armor",
            equipped: true,
            magicBonus: 0,
            armor: { baseAc: 10, isShield: true, shieldAcBonus: 1, armorType: "leather" },
          }),
          physItem({
            id: "a2",
            name: "Spare Leather",
            type: "armor",
            equipped: false,
            armor: { baseAc: 8, isShield: false, shieldAcBonus: 0, armorType: "leather" },
          }),
        ],
      }),
    );
    expect(c.combat.acBreakdown).toEqual([
      { label: "ADND2E.sheet.combat.acBase", value: 3 },
      { label: "ADND2E.sheet.combat.acShield", value: 1 },
      { label: "ADND2E.sheet.combat.acMagic", value: 1 },
      { label: "ADND2E.sheet.combat.acDex", value: -2 },
    ]);
    expect(c.combat.armor.map((a) => [a.id, a.isShield, a.baseAc])).toEqual([
      ["a1", false, 3],
      ["s1", true, 10],
      ["a2", false, 8],
    ]);
  });

  it("maneuverOptions is empty when combatAndTacticsEnabled is off, even with calledShots/combatManeuvers on", () => {
    const c = buildCharacterSheetContext(
      input({
        optionalRules: {
          ...DEFAULT_OPTIONAL_RULES,
          combatAndTacticsEnabled: false,
          calledShots: true,
          combatManeuvers: true,
        },
      }),
    );
    expect(c.combat.maneuverOptions).toEqual([]);
  });

  it("maneuverOptions includes only the 3 called-shot locations when calledShots is on and combatManeuvers is off", () => {
    const c = buildCharacterSheetContext(
      input({
        optionalRules: {
          ...DEFAULT_OPTIONAL_RULES,
          combatAndTacticsEnabled: true,
          calledShots: true,
          combatManeuvers: false,
        },
      }),
    );
    const values = c.combat.maneuverOptions.map((o) => o.value);
    expect(values).toEqual(["calledShotHead", "calledShotHand", "calledShotLeg"]);
  });

  it("maneuverOptions includes only the 4 curated maneuvers when combatManeuvers is on and calledShots is off", () => {
    const c = buildCharacterSheetContext(
      input({
        optionalRules: {
          ...DEFAULT_OPTIONAL_RULES,
          combatAndTacticsEnabled: true,
          calledShots: false,
          combatManeuvers: true,
        },
      }),
    );
    const values = c.combat.maneuverOptions.map((o) => o.value);
    expect(values).toEqual(["disarm", "tripKnockDown", "grapple", "bullRush"]);
  });

  it("maneuverOptions includes all 7 when both toggles are on", () => {
    const c = buildCharacterSheetContext(
      input({
        optionalRules: {
          ...DEFAULT_OPTIONAL_RULES,
          combatAndTacticsEnabled: true,
          calledShots: true,
          combatManeuvers: true,
        },
      }),
    );
    expect(c.combat.maneuverOptions).toHaveLength(7);
  });

  it("weapon proficiencies pass straight; nwp check targets are computed", () => {
    const weapon: WeaponProfView = { id: "wp1", name: "Sword", weaponOrGroup: "long-sword", isGroup: false, proficiencyGroup: "", slotsInvested: 1, masteryTier: 0, category: null, masteryTierLabelKey: null, canAdvanceMastery: false };
    const nwp: NwpView = {
      id: "n1",
      name: "Swimming",
      governingAbility: "str",
      modifier: -1,
      slotCost: 1,
      slotsInvested: 1,
      isRacial: false,
      governingAbilityLabel: "",
      checkTarget: null,
    };
    const c = buildCharacterSheetContext(
      input({ proficiencyItems: { weapon: [weapon], nonweapon: [nwp] } }),
    );
    expect(c.skills.weapon.items).toEqual([weapon]);
    expect(c.skills.weapon.available).toBe(4);
    // str score 17 + modifier -1
    expect(c.skills.nonweapon.items[0].checkTarget).toBe(16);
    // governingAbilityLabel resolved from config.abilities
    expect(c.skills.nonweapon.items[0].governingAbilityLabel).toBe("ADND2E.abilities.str");
  });

  it("nwp governingAbilityLabel falls back to the raw key when unmapped in config", () => {
    const nwp: NwpView = {
      id: "n2",
      name: "Swimming",
      governingAbility: "str",
      modifier: 0,
      slotCost: 1,
      slotsInvested: 1,
      isRacial: false,
      governingAbilityLabel: "",
      checkTarget: null,
    };
    const c = buildCharacterSheetContext(
      input({
        proficiencyItems: { weapon: [], nonweapon: [nwp] },
        config: { ...input().config, abilities: {} },
      }),
    );
    expect(c.skills.nonweapon.items[0].governingAbilityLabel).toBe("str");
  });
});

/* -------------------------------------------- spells / features / biography */

describe("buildCharacterSheetContext — spells / features / biography / tabs", () => {
  it("no caster class → null slot tables", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.spells.wizardSlots).toBeNull();
    expect(c.spells.priestSlots).toBeNull();
    expect(c.spells.specialistSchoolLabel).toBeNull();
    expect(c.spells.known).toEqual([]);
  });

  it("wizard slots become sorted rows", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: {
              specialistSchool: "evocation",
              slots: { "2": { max: 1, used: 1 }, "1": { max: 2, used: 0 } },
              memorized: [],
            },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        config: { ...input().config, schools: { evocation: "ADND2E.schools.evocation" } },
      }),
    );
    expect(c.spells.wizardSlots).toEqual([
      { level: 1, max: 2, used: 0 },
      { level: 2, max: 1, used: 1 },
    ]);
    expect(c.spells.specialistSchoolLabel).toBe("ADND2E.schools.evocation");
  });

  it("priest slots become rows too", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: {}, memorized: [] },
            priest: { slots: { "1": { max: 3, used: 1 } }, memorized: [], sphereAccessOverride: null },
          },
        },
      }),
    );
    expect(c.spells.priestSlots).toEqual([{ level: 1, max: 3, used: 1 }]);
  });

  it("known spells group by level, dropping empty levels", () => {
    const spell = (over: Partial<SpellItemView>): SpellItemView => ({
      id: "s",
      name: "Spell",
      img: "",
      casterClass: "wizard",
      level: 1,
      schools: [],
      spheres: [],
      range: "",
      castingTime: "",
      savingThrow: "",
      inSpellbook: true,
      memorized: false,
      expended: false,
      canMemorize: false,
      canCast: false,
      canLearn: false,
      favorite: false,
      ...over,
    });
    const c = buildCharacterSheetContext(
      input({
        spellItems: [
          spell({ id: "mm", name: "Magic Missile", level: 1 }),
          spell({ id: "sh", name: "Shield", level: 1 }),
          spell({ id: "fb", name: "Fireball", level: 3 }),
        ],
      }),
    );
    expect(c.spells.known.map((g) => [g.level, g.items.map((i) => i.id)])).toEqual([
      [1, ["mm", "sh"]],
      [3, ["fb"]],
    ]);
  });

  it("orphaned: a memorized entry with no matching spell item appears in spells.orphaned", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: {
              specialistSchool: null,
              slots: { "1": { max: 1, used: 1 } },
              memorized: [{ spellItemId: "deleted-spell", spellLevel: 1, expended: false }],
            },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [], // the spell item is gone — this is the whole point
      }),
    );
    expect(c.spells.orphaned).toEqual([
      { spellItemId: "deleted-spell", casterClass: "wizard", spellLevel: 1 },
    ]);
  });

  it("orphaned: a priest memorized entry with no matching spell item also appears", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: {}, memorized: [] },
            priest: {
              slots: { "2": { max: 1, used: 1 } },
              memorized: [{ spellItemId: "deleted-priest-spell", spellLevel: 2, expended: false }],
              sphereAccessOverride: null,
            },
          },
        },
        spellItems: [],
      }),
    );
    expect(c.spells.orphaned).toEqual([
      { spellItemId: "deleted-priest-spell", casterClass: "priest", spellLevel: 2 },
    ]);
  });

  it("orphaned: a memorized entry WITH a matching spell item is NOT orphaned", () => {
    const spell = (over: Partial<SpellItemView>): SpellItemView => ({
      id: "s", name: "Spell", img: "", casterClass: "wizard", level: 1,
      schools: [], spheres: [], range: "", castingTime: "", savingThrow: "",
      inSpellbook: true, memorized: false, expended: false, canMemorize: false, canCast: false,
      canLearn: false,
      favorite: false,
      ...over,
    });
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: {
              specialistSchool: null,
              slots: { "1": { max: 1, used: 1 } },
              memorized: [{ spellItemId: "s", spellLevel: 1, expended: false }],
            },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [spell({ id: "s" })],
      }),
    );
    expect(c.spells.orphaned).toEqual([]);
  });

  it("features group by sourceType; resources + languages pass through", () => {
    const feat = (over: Partial<FeatureItemView>): FeatureItemView => ({
      id: "f",
      name: "Feat",
      img: "",
      sourceType: "class",
      activation: "passive",
      uses: null,
      description: "",
      ...over,
    });
    const c = buildCharacterSheetContext(
      input({
        featureItems: [
          feat({ id: "f1", sourceType: "class" }),
          feat({ id: "f2", sourceType: "class" }),
          feat({ id: "f3", sourceType: "kit" }),
        ],
      }),
    );
    expect(c.features.groups.map((g) => [g.sourceType, g.items.map((i) => i.id)])).toEqual([
      ["class", ["f1", "f2"]],
      ["kit", ["f3"]],
    ]);
    expect(c.features.groups.map((g) => g.sourceTypeLabel)).toEqual([
      "ADND2E.sheet.features.sourceTypes.class",
      "ADND2E.sheet.features.sourceTypes.kit",
    ]);
    expect(c.features.languagesMax).toBe(2);
    expect(c.features.resources).toEqual({ reputation: "", henchmen: "", followers: "" });
    expect(c.features.racialAbilities).toEqual([]);
  });

  it("an unmapped sourceType falls back to the raw string as its own label", () => {
    const feat = (over: Partial<FeatureItemView>): FeatureItemView => ({
      id: "f",
      name: "Feat",
      img: "",
      sourceType: "class",
      activation: "passive",
      uses: null,
      description: "",
      ...over,
    });
    const c = buildCharacterSheetContext(
      input({ featureItems: [feat({ id: "f1", sourceType: "homebrew" })] }),
    );
    expect(c.features.groups[0].sourceTypeLabel).toBe("homebrew");
  });

  it("biography detail fields are the fixed list; gm notes visible for a GM", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.biography.detailFields).toEqual([
      "age",
      "sex",
      "height",
      "weight",
      "hairEyes",
      "homeland",
      "deity",
      "kit",
    ]);
    expect(c.biography.showGmNotes).toBe(true);
  });

  it("gm notes hidden for a non-GM", () => {
    expect(
      buildCharacterSheetContext(input({ perms: { isGM: false, isOwner: true, editable: true } }))
        .biography.showGmNotes,
    ).toBe(false);
  });

  it("six tabs in order (sheet redesign R1)", () => {
    expect(buildCharacterSheetContext(input()).tabs.map((t) => t.id)).toEqual([
      "main",
      "inventory",
      "proficiencies",
      "spells",
      "features",
      "journal",
    ]);
  });
});

describe("buildCharacterSheetContext — spell memorize/cast eligibility", () => {
  const wizardSpell = (over: Partial<SpellItemView>): SpellItemView => ({
    id: "mm",
    name: "Magic Missile",
    img: "",
    casterClass: "wizard",
    level: 1,
    schools: ["evocation"],
    spheres: [],
    range: "",
    castingTime: "",
    savingThrow: "none",
    inSpellbook: false,
    memorized: false,
    expended: false,
    canMemorize: false,
    canCast: false,
    canLearn: false,
    favorite: false,
    ...over,
  });

  it("wizard spell not in spellbook, slot free → cannot memorize", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: { "1": { max: 2, used: 0 } }, memorized: [] },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ inSpellbook: false })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canMemorize).toBe(false);
  });

  it("wizard spell in spellbook, slot free → can memorize", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: { "1": { max: 2, used: 0 } }, memorized: [] },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ inSpellbook: true })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canMemorize).toBe(true);
  });

  it("wizard spell in spellbook, no free slot (used === max) → cannot memorize", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: { "1": { max: 1, used: 1 } }, memorized: [] },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ inSpellbook: true })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canMemorize).toBe(false);
  });

  it("memorized, not expended → canCast true, canMemorize false", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: {
              specialistSchool: null,
              slots: { "1": { max: 1, used: 1 } },
              memorized: [{ spellItemId: "mm", spellLevel: 1, expended: false }],
            },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ inSpellbook: true })],
      }),
    );
    const row = c.spells.known[0]!.items[0]!;
    expect(row.memorized).toBe(true);
    expect(row.expended).toBe(false);
    expect(row.canCast).toBe(true);
    expect(row.canMemorize).toBe(false);
  });

  it("memorized AND expended → canCast false", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: {
              specialistSchool: null,
              slots: { "1": { max: 1, used: 1 } },
              memorized: [{ spellItemId: "mm", spellLevel: 1, expended: true }],
            },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ inSpellbook: true })],
      }),
    );
    const row = c.spells.known[0]!.items[0]!;
    expect(row.expended).toBe(true);
    expect(row.canCast).toBe(false);
  });

  it("priest spell within sphere access + level cap, slot free → can memorize", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [
          {
            id: "c1", name: "Cleric", img: "", chassisId: "cleric", hitDie: 8,
            xp: 0, level: 5, canLevelUp: false, dualClassState: null, specialistSchool: null,
          },
        ],
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: {}, memorized: [] },
            priest: { slots: { "1": { max: 2, used: 0 } }, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [
          wizardSpell({
            id: "cure", name: "Cure Light Wounds", casterClass: "priest",
            level: 1, schools: [], spheres: ["healing"], inSpellbook: false,
          }),
        ],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canMemorize).toBe(true);
  });

  it("priest spell in a sphere the cleric table has no access to → cannot memorize", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [
          {
            id: "c1", name: "Cleric", img: "", chassisId: "cleric", hitDie: 8,
            xp: 0, level: 5, canLevelUp: false, dualClassState: null, specialistSchool: null,
          },
        ],
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: {}, memorized: [] },
            priest: { slots: { "1": { max: 2, used: 0 } }, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [
          wizardSpell({
            id: "speak", name: "Speak With Animals", casterClass: "priest",
            level: 1, schools: [], spheres: ["animal"], inSpellbook: false,
          }),
        ],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canMemorize).toBe(false);
  });

  it("a spell row is not favorite by default; favorite true when the actor's favorites list it", () => {
    const notFav = buildCharacterSheetContext(input({ spellItems: [wizardSpell({ inSpellbook: true })] }));
    expect(notFav.spells.known[0]!.items[0]!.favorite).toBe(false);
    const fav = buildCharacterSheetContext(
      input({ spellItems: [wizardSpell({ inSpellbook: true })], favorites: [{ kind: "spell", id: "mm" }] }),
    );
    expect(fav.spells.known[0]!.items[0]!.favorite).toBe(true);
  });
});

describe("buildCharacterSheetContext — spell learn eligibility", () => {
  const wizardSpell = (over: Partial<SpellItemView>): SpellItemView => ({
    id: "mm",
    name: "Magic Missile",
    img: "",
    casterClass: "wizard",
    level: 1,
    // "invocation" = PHB Invocation/Evocation (this codebase's WizardSchool has
    // no separate "evocation" value — see core/types.ts's WizardSchool doc comment).
    schools: ["invocation"],
    spheres: [],
    range: "",
    castingTime: "",
    savingThrow: "none",
    inSpellbook: false,
    memorized: false,
    expended: false,
    canMemorize: false,
    canCast: false,
    canLearn: false,
    favorite: false,
    ...over,
  });
  const fullInt = {
    bonusLanguages: 0, maxSpellLevel: 9, learnSpellChance: 70,
    maxSpellsPerLevel: null, illusionImmunityLevel: null,
  };

  it("wizard spell not in spellbook, INT allows it → canLearn true", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, int: { score: 15, mods: fullInt as never } },
          spellcasting: {
            wizard: { specialistSchool: null, slots: { "1": { max: 1, used: 0 } }, memorized: [] },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ inSpellbook: false })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canLearn).toBe(true);
  });

  it("wizard spell not in spellbook, but the actor can't yet cast this spell level at all → canLearn false", () => {
    // spellcasting.wizard.slots defaults to {} (no entry at this spell's
    // level) — e.g. a level-1 mage looking at a spell whose level exceeds
    // what their wizard slot table grants. canLearnSpell's own doc comment
    // requires the caller to confirm castability before calling it; this is
    // that gate, and INT alone must not be enough to bypass it.
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, int: { score: 15, mods: fullInt as never } },
        },
        spellItems: [wizardSpell({ inSpellbook: false })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canLearn).toBe(false);
  });

  it("wizard spell already in spellbook → canLearn false (nothing to learn)", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, int: { score: 15, mods: fullInt as never } },
        },
        spellItems: [wizardSpell({ inSpellbook: true })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canLearn).toBe(false);
  });

  it("wizard spell in the specialist's own opposition school → canLearn false", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, int: { score: 15, mods: fullInt as never } },
          spellcasting: {
            wizard: { specialistSchool: "abjuration", slots: { "1": { max: 1, used: 0 } }, memorized: [] },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ schools: ["illusion"], inSpellbook: false })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canLearn).toBe(false);
  });

  it("priest spell → canLearn always false regardless of INT", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, int: { score: 18, mods: fullInt as never } },
        },
        spellItems: [
          wizardSpell({ casterClass: "priest", schools: [], spheres: ["healing"], inSpellbook: false }),
        ],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canLearn).toBe(false);
  });
});

describe("buildCharacterSheetContext — weapon specialization eligibility + real checkTarget", () => {
  const weaponItem = (over: Partial<PhysicalItemView> = {}): PhysicalItemView => ({
    id: "w1", name: "Long Sword", img: "", type: "weapon",
    quantity: 1, weight: 4, totalWeight: 4, location: "", equipped: true, identified: true, magicBonus: 0,
    isContainer: false, capacity: null, contentsWeightMultiplier: 1,
    weapon: { damageVsSM: "1d8", damageVsL: "1d12", speedFactor: 5, range: null, category: "melee", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: "slashing", ammoType: null, selectedAmmoId: null },
    ...over,
  });
  const weaponProf = (over: Partial<WeaponProfView> = {}): WeaponProfView => ({
    id: "wp1", name: "Long Sword Proficiency", weaponOrGroup: "Long Sword", isGroup: false, proficiencyGroup: "",
    slotsInvested: 1, masteryTier: 0, category: null, masteryTierLabelKey: null, canAdvanceMastery: false,
    ...over,
  });
  const fighterClass = {
    id: "c1", name: "Fighter", img: "", chassisId: "fighter", hitDie: 10,
    xp: 0, level: 1, canLevelUp: false, dualClassState: null, specialistSchool: null,
  };
  // Tiers 2-3 are gated behind combatAndTacticsEnabled + weaponMastery both being on
  // (tier 1, plain PHB Specialization, is NOT — see the gate block near the end of this
  // describe). This block's default fixture (`input()`) has both off, so the tests that
  // exercise tiers 2-3 opt them in explicitly via `masteryOptionalRules`.
  const masteryOptionalRules = { ...DEFAULT_OPTIONAL_RULES, combatAndTacticsEnabled: true, weaponMastery: true };

  it("single-classed fighter, matching owned weapon, enough slots → canAdvanceMastery true, category resolved", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf()], nonweapon: [] },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    const row = c.skills.weapon.items[0]!;
    expect(row.category).toBe("melee");
    expect(row.canAdvanceMastery).toBe(true);
  });

  it("not enough available slots → canAdvanceMastery false", () => {
    // weaponProf() has slotsInvested: 1; melee tier 1 costs 2 slots total,
    // so the marginal cost to advance now is 2 - 1 = 1. With 0 available, that
    // marginal cost can't be afforded.
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf()], nonweapon: [] },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 4, available: 0 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.canAdvanceMastery).toBe(false);
  });

  it("already at tier 3 (Grand Mastery) → canAdvanceMastery false", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf({ masteryTier: 3, slotsInvested: 7 })], nonweapon: [] },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 10, spent: 7, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    const row = c.skills.weapon.items[0]!;
    expect(row.masteryTierLabelKey).toBe("ADND2E.sheet.skills.masteryTier.3");
    expect(row.canAdvanceMastery).toBe(false);
  });

  it("tier 1 → tier 2, enough slots → canAdvanceMastery true, masteryTierLabelKey reflects current tier", () => {
    // melee tier 2 costs 4 slots total; slotsInvested 2 → marginal cost 2, affordable with 3 available.
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf({ masteryTier: 1, slotsInvested: 2 })], nonweapon: [] },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 5, spent: 2, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    const row = c.skills.weapon.items[0]!;
    expect(row.masteryTierLabelKey).toBe("ADND2E.sheet.skills.masteryTier.1");
    expect(row.canAdvanceMastery).toBe(true);
  });

  it("tier 2 → tier 3, not enough slots → canAdvanceMastery false", () => {
    // melee tier 3 costs 7 slots total; slotsInvested 4 → marginal cost 3, unaffordable with 1 available.
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf({ masteryTier: 2, slotsInvested: 4 })], nonweapon: [] },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 5, spent: 4, available: 1 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    const row = c.skills.weapon.items[0]!;
    expect(row.masteryTierLabelKey).toBe("ADND2E.sheet.skills.masteryTier.2");
    expect(row.canAdvanceMastery).toBe(false);
  });

  it("tier 2 → tier 3, enough slots → canAdvanceMastery true", () => {
    // melee tier 3 costs 7 slots total; slotsInvested 4 → marginal cost 3, affordable with 3 available.
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf({ masteryTier: 2, slotsInvested: 4 })], nonweapon: [] },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 7, spent: 4, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.canAdvanceMastery).toBe(true);
  });

  it("a group proficiency is never mastery-eligible (category null)", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf({ isGroup: true, weaponOrGroup: "Blades" })], nonweapon: [] },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    const row = c.skills.weapon.items[0]!;
    expect(row.category).toBeNull();
    expect(row.canAdvanceMastery).toBe(false);
  });

  it("a non-fighter class (specializationAllowed false) → canAdvanceMastery false even with slots to spare", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [{ ...fighterClass, chassisId: "mage" }],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf()], nonweapon: [] },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.canAdvanceMastery).toBe(false);
  });

  /* --- the optional-rule gate applies ONLY above tier 1 ---------------------
   * Tier 0 → 1 is plain PHB weapon Specialization: a base-rules mechanic that
   * predates Combat & Tactics, so it must stay purchasable with the toggles
   * off (both default to false). Tiers 2-3 (Mastery / Grand Mastery) are the
   * C&T-only additions and ARE gated. This mirrors combat-rolls.ts's
   * resolveProficiencyModifier, which lets tier 1's bonus through
   * unconditionally and caps tiers 2-3 back to 1 when the rule is off. */

  it("tier 0 → 1 (plain Specialization) is NOT gated: canAdvanceMastery true with weaponMastery off", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf()], nonweapon: [] },
        optionalRules: { ...DEFAULT_OPTIONAL_RULES, combatAndTacticsEnabled: true, weaponMastery: false },
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.canAdvanceMastery).toBe(true);
  });

  it("tier 0 → 1 is NOT gated by combatAndTacticsEnabled either (both defaults off)", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf()], nonweapon: [] },
        optionalRules: { ...DEFAULT_OPTIONAL_RULES, combatAndTacticsEnabled: false, weaponMastery: false },
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.canAdvanceMastery).toBe(true);
  });

  it("tier 1 → 2 IS gated: weaponMastery off → canAdvanceMastery false, on → true", () => {
    // melee tier 2 costs 4 slots total; slotsInvested 2 → marginal cost 2, affordable with 3 available.
    const profInput = (optionalRules: CharacterSheetInput["optionalRules"]) =>
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf({ masteryTier: 1, slotsInvested: 2 })], nonweapon: [] },
        optionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 5, spent: 2, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      });
    expect(
      buildCharacterSheetContext(profInput({ ...DEFAULT_OPTIONAL_RULES, combatAndTacticsEnabled: true, weaponMastery: false }))
        .skills.weapon.items[0]!.canAdvanceMastery,
    ).toBe(false);
    expect(
      buildCharacterSheetContext(profInput({ ...DEFAULT_OPTIONAL_RULES, combatAndTacticsEnabled: false, weaponMastery: true }))
        .skills.weapon.items[0]!.canAdvanceMastery,
    ).toBe(false);
    expect(
      buildCharacterSheetContext(profInput(masteryOptionalRules)).skills.weapon.items[0]!.canAdvanceMastery,
    ).toBe(true);
  });

  it("tier 2 → 3 IS gated too (the gate applies at every tier above 1, not just once)", () => {
    // melee tier 3 costs 7 slots total; slotsInvested 4 → marginal cost 3, affordable with 3 available.
    const profInput = (optionalRules: CharacterSheetInput["optionalRules"]) =>
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf({ masteryTier: 2, slotsInvested: 4 })], nonweapon: [] },
        optionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 7, spent: 4, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      });
    expect(
      buildCharacterSheetContext(profInput({ ...DEFAULT_OPTIONAL_RULES, combatAndTacticsEnabled: true, weaponMastery: false }))
        .skills.weapon.items[0]!.canAdvanceMastery,
    ).toBe(false);
    expect(
      buildCharacterSheetContext(profInput({ ...DEFAULT_OPTIONAL_RULES, combatAndTacticsEnabled: false, weaponMastery: true }))
        .skills.weapon.items[0]!.canAdvanceMastery,
    ).toBe(false);
    expect(
      buildCharacterSheetContext(profInput(masteryOptionalRules)).skills.weapon.items[0]!.canAdvanceMastery,
    ).toBe(true);
  });

  it("resolves category 'bow' for a bow-type weapon", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [
          weaponItem({
            id: "w2", name: "Long Bow",
            weapon: { damageVsSM: "1d6", damageVsL: "1d6", speedFactor: 7, range: "70/140/210", category: "bow", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: "piercing", ammoType: null, selectedAmmoId: null },
          }),
        ],
        proficiencyItems: {
          weapon: [weaponProf({ weaponOrGroup: "Long Bow" })],
          nonweapon: [],
        },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.category).toBe("bow");
  });

  it("resolves category 'crossbow' for a crossbow-type weapon", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [
          weaponItem({
            id: "w3", name: "Light Crossbow",
            weapon: { damageVsSM: "1d4", damageVsL: "1d4", speedFactor: 8, range: "60/120/180", category: "crossbow", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: "piercing", ammoType: null, selectedAmmoId: null },
          }),
        ],
        proficiencyItems: {
          weapon: [weaponProf({ weaponOrGroup: "Light Crossbow" })],
          nonweapon: [],
        },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.category).toBe("crossbow");
  });

  it("resolves category from proficiencyGroup even with no matching owned weapon — can specialize before owning the weapon", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [], // no owned weapon at all
        proficiencyItems: { weapon: [weaponProf({ proficiencyGroup: "Blades" })], nonweapon: [] },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    const row = c.skills.weapon.items[0]!;
    expect(row.category).toBe("melee");
    expect(row.canAdvanceMastery).toBe(true);
  });

  it("proficiencyGroup 'Bows'/'Crossbows' resolve their own category with no owned weapon", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [],
        proficiencyItems: {
          weapon: [
            weaponProf({ id: "wp1", weaponOrGroup: "Long Bow", proficiencyGroup: "Bows" }),
            weaponProf({ id: "wp2", weaponOrGroup: "Light Crossbow", proficiencyGroup: "Crossbows" }),
          ],
          nonweapon: [],
        },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 10, spent: 2, available: 8 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.category).toBe("bow");
    expect(c.skills.weapon.items[1]!.category).toBe("crossbow");
  });

  it("an unset/unrecognized proficiencyGroup falls back to the owned-weapon lookup, unchanged from before", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf({ proficiencyGroup: "" })], nonweapon: [] },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.category).toBe("melee");
  });

  it("a renamed/magic weapon matches its proficiency via baseWeaponName, not its display name", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [
          weaponItem({ name: "Long Sword +1", weapon: { ...weaponItem().weapon!, baseWeaponName: "Long Sword" } }),
        ],
        proficiencyItems: { weapon: [weaponProf()], nonweapon: [] }, // weaponOrGroup: "Long Sword"
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    const row = c.skills.weapon.items[0]!;
    expect(row.category).toBe("melee");
    expect(row.canAdvanceMastery).toBe(true);
  });

  it("a renamed weapon with no baseWeaponName set no longer matches its proficiency (pre-existing exact-name gap)", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem({ name: "Long Sword +1" })], // baseWeaponName still blank
        proficiencyItems: { weapon: [weaponProf({ proficiencyGroup: "" })], nonweapon: [] },
        optionalRules: masteryOptionalRules,
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.category).toBeNull();
  });

  describe("combat.weapons[].grandMasteryExtraAttack", () => {
    it("true at Grand Mastery (tier 3) via an exact specific-weapon match", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [fighterClass],
          physicalItems: [weaponItem()],
          proficiencyItems: { weapon: [weaponProf({ masteryTier: 3 })], nonweapon: [] },
          optionalRules: masteryOptionalRules,
        }),
      );
      expect(c.combat.weapons[0]!.grandMasteryExtraAttack).toBe(true);
    });

    it("false below Grand Mastery (tier 2)", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [fighterClass],
          physicalItems: [weaponItem()],
          proficiencyItems: { weapon: [weaponProf({ masteryTier: 2 })], nonweapon: [] },
          optionalRules: masteryOptionalRules,
        }),
      );
      expect(c.combat.weapons[0]!.grandMasteryExtraAttack).toBe(false);
    });

    it("false with no matching proficiency at all", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [fighterClass],
          physicalItems: [weaponItem()],
          proficiencyItems: { weapon: [], nonweapon: [] },
          optionalRules: masteryOptionalRules,
        }),
      );
      expect(c.combat.weapons[0]!.grandMasteryExtraAttack).toBe(false);
    });

    it("false when the weaponMastery optional rule is off, even at a stored tier 3", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [fighterClass],
          physicalItems: [weaponItem()],
          proficiencyItems: { weapon: [weaponProf({ masteryTier: 3 })], nonweapon: [] },
          optionalRules: { ...DEFAULT_OPTIONAL_RULES, combatAndTacticsEnabled: true, weaponMastery: false },
        }),
      );
      expect(c.combat.weapons[0]!.grandMasteryExtraAttack).toBe(false);
    });

    it("matches via baseWeaponName on a renamed/magic weapon", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [fighterClass],
          physicalItems: [
            weaponItem({ name: "Long Sword +1", weapon: { ...weaponItem().weapon!, baseWeaponName: "Long Sword" } }),
          ],
          proficiencyItems: { weapon: [weaponProf({ masteryTier: 3 })], nonweapon: [] }, // weaponOrGroup: "Long Sword"
          optionalRules: masteryOptionalRules,
        }),
      );
      expect(c.combat.weapons[0]!.grandMasteryExtraAttack).toBe(true);
    });

    it("resolves tier 3 via a group match when no exact match exists", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [fighterClass],
          physicalItems: [weaponItem({ weapon: { ...weaponItem().weapon!, proficiencyGroup: "Blades" } })],
          proficiencyItems: {
            weapon: [weaponProf({ isGroup: true, weaponOrGroup: "Blades", masteryTier: 3 })],
            nonweapon: [],
          },
          optionalRules: masteryOptionalRules,
        }),
      );
      expect(c.combat.weapons[0]!.grandMasteryExtraAttack).toBe(true);
    });
  });

  describe("combat.weapons[].specialistAttackRate (PHB Table 35)", () => {
    it("resolves the rate for a Specialized (tier 1+) fighter with specialistWeaponClass set", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [fighterClass], // level: 1
          physicalItems: [weaponItem({ weapon: { ...weaponItem().weapon!, specialistWeaponClass: "melee" } })],
          proficiencyItems: { weapon: [weaponProf({ masteryTier: 1 })], nonweapon: [] },
          optionalRules: masteryOptionalRules,
        }),
      );
      expect(c.combat.weapons[0]!.specialistAttackRate).toEqual({ attacks: 3, rounds: 2 });
    });

    it("null when not Specialized (tier 0)", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [fighterClass],
          physicalItems: [weaponItem({ weapon: { ...weaponItem().weapon!, specialistWeaponClass: "melee" } })],
          proficiencyItems: { weapon: [weaponProf({ masteryTier: 0 })], nonweapon: [] },
          optionalRules: masteryOptionalRules,
        }),
      );
      expect(c.combat.weapons[0]!.specialistAttackRate).toBeNull();
    });

    it("null when specialistWeaponClass isn't set", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [fighterClass],
          physicalItems: [weaponItem()], // specialistWeaponClass: ""
          proficiencyItems: { weapon: [weaponProf({ masteryTier: 1 })], nonweapon: [] },
          optionalRules: masteryOptionalRules,
        }),
      );
      expect(c.combat.weapons[0]!.specialistAttackRate).toBeNull();
    });

    it("NOT gated by the weaponMastery optional rule — unlike Grand Mastery's badge, tier 1 is always-on", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [fighterClass],
          physicalItems: [weaponItem({ weapon: { ...weaponItem().weapon!, specialistWeaponClass: "melee" } })],
          proficiencyItems: { weapon: [weaponProf({ masteryTier: 1 })], nonweapon: [] },
          optionalRules: { ...DEFAULT_OPTIONAL_RULES, combatAndTacticsEnabled: false, weaponMastery: false },
        }),
      );
      expect(c.combat.weapons[0]!.specialistAttackRate).toEqual({ attacks: 3, rounds: 2 });
    });

    it("null for a multiclassed fighter (canWeaponSpecialize's isSingleClass gate)", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [fighterClass, { ...fighterClass, id: "c2", chassisId: "thief" }],
          physicalItems: [weaponItem({ weapon: { ...weaponItem().weapon!, specialistWeaponClass: "melee" } })],
          proficiencyItems: { weapon: [weaponProf({ masteryTier: 1 })], nonweapon: [] },
          optionalRules: masteryOptionalRules,
        }),
      );
      expect(c.combat.weapons[0]!.specialistAttackRate).toBeNull();
    });

    it("null for a non-fighter class (specializationAllowed false)", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [{ ...fighterClass, chassisId: "mage" }],
          physicalItems: [weaponItem({ weapon: { ...weaponItem().weapon!, specialistWeaponClass: "melee" } })],
          proficiencyItems: { weapon: [weaponProf({ masteryTier: 1 })], nonweapon: [] },
          optionalRules: masteryOptionalRules,
        }),
      );
      expect(c.combat.weapons[0]!.specialistAttackRate).toBeNull();
    });

    it("selects the level band from the fighter's own level", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [{ ...fighterClass, level: 13 }],
          physicalItems: [weaponItem({ weapon: { ...weaponItem().weapon!, specialistWeaponClass: "melee" } })],
          proficiencyItems: { weapon: [weaponProf({ masteryTier: 1 })], nonweapon: [] },
          optionalRules: masteryOptionalRules,
        }),
      );
      expect(c.combat.weapons[0]!.specialistAttackRate).toEqual({ attacks: 5, rounds: 2 });
    });

    it("resolves via a matching specialistWeaponClass other than melee", () => {
      const c = buildCharacterSheetContext(
        input({
          classItems: [fighterClass],
          physicalItems: [weaponItem({ weapon: { ...weaponItem().weapon!, specialistWeaponClass: "heavy-crossbow" } })],
          proficiencyItems: { weapon: [weaponProf({ masteryTier: 1 })], nonweapon: [] },
          optionalRules: masteryOptionalRules,
        }),
      );
      expect(c.combat.weapons[0]!.specialistAttackRate).toEqual({ attacks: 1, rounds: 2 });
    });
  });

  it("checkTarget includes the (slotsInvested-1) bonus", () => {
    const c = buildCharacterSheetContext(
      input({
        proficiencyItems: {
          weapon: [],
          nonweapon: [{
            id: "n1", name: "Herbalism", governingAbility: "int", modifier: 0,
            slotCost: 1, slotsInvested: 3, isRacial: false, governingAbilityLabel: "", checkTarget: null,
          }],
        },
      }),
    );
    // base fixture's INT score is 10 (see the base input() helper) — target = 10 + 0 + (3-1) = 12
    expect(c.skills.nonweapon.items[0]!.checkTarget).toBe(12);
  });
});

describe("buildCharacterSheetContext — thief/bard skills + backstab eligibility", () => {
  const thiefClass = {
    id: "c1", name: "Thief", img: "", chassisId: "thief", hitDie: 6,
    xp: 0, level: 1, canLevelUp: false, dualClassState: null, specialistSchool: null,
  };
  const bardClass = { ...thiefClass, name: "Bard", chassisId: "bard" };
  const fighterClass = { ...thiefClass, name: "Fighter", chassisId: "fighter" };

  it("thief with no armor gets all 8 skills, unallocated, armor not disabled", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [thiefClass],
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, dex: { score: 12, mods: input().derived.abilities.dex.mods } },
          thiefSkills: { total: 60, spent: 0, available: 60 },
        },
      }),
    );
    expect(c.skills.thief).not.toBeNull();
    expect(c.skills.thief!.items).toHaveLength(8);
    expect(c.skills.thief!.armorDisabled).toBe(false);
    // pick-pockets base 15, DEX 12 gives 0 adjustment (Table 28); no armor
    // equipped resolves to the "none" (unarmored) Table 29 category, which
    // gives pick-pockets a +5 bonus (NOT leather's baseline 0) — base 20.
    const pp = c.skills.thief!.items.find((r) => r.skill === "pick-pockets")!;
    expect(pp.base).toBe(20);
    expect(pp.allocated).toBe(0);
    expect(pp.effective).toBe(20);
  });

  it("bard gets exactly the 4-skill subset, and no per-skill cap blocks a large single allocation", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [bardClass],
        thiefSkillAllocations: [{ skill: "climb-walls", allocatedPoints: 40 }],
        derived: {
          ...input().derived,
          thiefSkills: { total: 35, spent: 40, available: -5 },
        },
      }),
    );
    expect(c.skills.thief!.items).toHaveLength(4);
    expect(c.skills.thief!.items.map((r) => r.skill).sort()).toEqual(
      ["climb-walls", "detect-noise", "pick-pockets", "read-languages"].sort(),
    );
    const cw = c.skills.thief!.items.find((r) => r.skill === "climb-walls")!;
    // no per-skill cap for bards — canAllocate is false here only because available (-5) is not > 0
    expect(cw.canAllocate).toBe(false);
    expect(cw.canDeallocate).toBe(true);
  });

  it("a class with no thief-skill access gets a null thief section", () => {
    const c = buildCharacterSheetContext(input({ classItems: [fighterClass] }));
    expect(c.skills.thief).toBeNull();
  });

  it("heavy armor (e.g. chain mail) disables the whole thief-skills section", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [thiefClass],
        physicalItems: [{
          id: "a1", name: "Chain Mail", img: "", type: "armor",
          quantity: 1, weight: 40, totalWeight: 40, location: "", equipped: true, identified: true, magicBonus: 0,
          isContainer: false, capacity: null, contentsWeightMultiplier: 1,
          armor: { baseAc: 5, isShield: false, shieldAcBonus: 0, armorType: "chain-mail" },
        }],
      }),
    );
    expect(c.skills.thief!.armorDisabled).toBe(true);
  });

  it("canAllocate respects the thief per-skill cap even with plenty of pool available", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [thiefClass],
        thiefSkillAllocations: [{ skill: "pick-pockets", allocatedPoints: 30 }],
        derived: {
          ...input().derived,
          thiefSkills: { total: 60, spent: 30, available: 30 },
        },
      }),
    );
    // thiefSkillPerSkillCap(1) = 30 — already at the cap, so canAllocate is false despite 30 available
    const pp = c.skills.thief!.items.find((r) => r.skill === "pick-pockets")!;
    expect(pp.canAllocate).toBe(false);
  });

  it("a thief with a backstab-eligible weapon gets canBackstab true on that weapon's combat row", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [thiefClass],
        physicalItems: [{
          id: "w1", name: "Dagger", img: "", type: "weapon",
          quantity: 1, weight: 1, totalWeight: 1, location: "", equipped: true, identified: true, magicBonus: 0,
          isContainer: false, capacity: null, contentsWeightMultiplier: 1,
          weapon: { damageVsSM: "1d4", damageVsL: "1d3", speedFactor: 2, range: null, category: "melee", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: "piercing", ammoType: null, selectedAmmoId: null },
        }],
      }),
    );
    expect(c.combat.weapons[0]!.canBackstab).toBe(true);
  });

  it("a fighter (not a thief) with the SAME eligible weapon gets canBackstab false", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [{
          id: "w1", name: "Dagger", img: "", type: "weapon",
          quantity: 1, weight: 1, totalWeight: 1, location: "", equipped: true, identified: true, magicBonus: 0,
          isContainer: false, capacity: null, contentsWeightMultiplier: 1,
          weapon: { damageVsSM: "1d4", damageVsL: "1d3", speedFactor: 2, range: null, category: "melee", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: "piercing", ammoType: null, selectedAmmoId: null },
        }],
      }),
    );
    expect(c.combat.weapons[0]!.canBackstab).toBe(false);
  });

  it("a thief with a non-eligible weapon (bludgeoning) gets canBackstab false", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [thiefClass],
        physicalItems: [{
          id: "w1", name: "Mace", img: "", type: "weapon",
          quantity: 1, weight: 6, totalWeight: 6, location: "", equipped: true, identified: true, magicBonus: 0,
          isContainer: false, capacity: null, contentsWeightMultiplier: 1,
          weapon: { damageVsSM: "1d6", damageVsL: "1d6", speedFactor: 7, range: null, category: "melee", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: "bludgeoning", ammoType: null, selectedAmmoId: null },
        }],
      }),
    );
    expect(c.combat.weapons[0]!.canBackstab).toBe(false);
  });

  it("a bard's effective score uses Table 33 (bard base), not Table 26 (thief base) — pick-pockets differs by exactly the old bug's margin", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [bardClass],
        thiefSkillAllocations: [{ skill: "pick-pockets", allocatedPoints: 10 }],
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, dex: { score: 12, mods: input().derived.abilities.dex.mods } },
          thiefSkills: { total: 20, spent: 10, available: 10 },
        },
      }),
    );
    const pp = c.skills.thief!.items.find((r) => r.skill === "pick-pockets")!;
    // Table 33 base 10 + 0 racial (human) + 0 dex (12) + 5 armor ("none" category, nothing
    // equipped) = 15 — this was already correct pre-fix (buildThiefSkills always used
    // bardSkillBaseScore for `base`).
    expect(pp.base).toBe(15);
    expect(pp.allocated).toBe(10);
    // effective = base + allocated = 25. The pre-fix bug called resolveThiefSkill
    // (Table 26 base 15 -> 20 with the same armor bonus) and would have shown 30 here —
    // 5 too high, exactly the Table 26 vs Table 33 base difference for pick-pockets.
    expect(pp.effective).toBe(25);
  });

  it("fighter-then-thief (thief is NOT classItems[0]) still gets a non-null thief section and canBackstab true", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [{ ...fighterClass, id: "c1" }, { ...thiefClass, id: "c2" }],
        physicalItems: [{
          id: "w1", name: "Dagger", img: "", type: "weapon",
          quantity: 1, weight: 1, totalWeight: 1, location: "", equipped: true, identified: true, magicBonus: 0,
          isContainer: false, capacity: null, contentsWeightMultiplier: 1,
          weapon: { damageVsSM: "1d4", damageVsL: "1d3", speedFactor: 2, range: null, category: "melee", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: "piercing", ammoType: null, selectedAmmoId: null },
        }],
      }),
    );
    expect(c.skills.thief).not.toBeNull();
    expect(c.combat.weapons[0]!.canBackstab).toBe(true);
  });

  it("a level-1 thief's read-languages row is not usable (PHB p.40: requires thief level 4)", () => {
    const c = buildCharacterSheetContext(input({ classItems: [thiefClass] }));
    const rl = c.skills.thief!.items.find((r) => r.skill === "read-languages")!;
    expect(rl.usable).toBe(false);
  });

  it("a level-4+ thief's read-languages row is usable", () => {
    const c = buildCharacterSheetContext(input({ classItems: [{ ...thiefClass, level: 4 }] }));
    const rl = c.skills.thief!.items.find((r) => r.skill === "read-languages")!;
    expect(rl.usable).toBe(true);
  });

  it("a bard's read-languages row is always usable regardless of level (no such gate for bards)", () => {
    const c1 = buildCharacterSheetContext(input({ classItems: [{ ...bardClass, level: 1 }] }));
    expect(c1.skills.thief!.items.find((r) => r.skill === "read-languages")!.usable).toBe(true);
    const c2 = buildCharacterSheetContext(input({ classItems: [{ ...bardClass, level: 20 }] }));
    expect(c2.skills.thief!.items.find((r) => r.skill === "read-languages")!.usable).toBe(true);
  });

  it("every skill other than read-languages is always usable regardless of level", () => {
    const c = buildCharacterSheetContext(input({ classItems: [{ ...thiefClass, level: 1 }] }));
    for (const row of c.skills.thief!.items) {
      if (row.skill === "read-languages") continue;
      expect(row.usable).toBe(true);
    }
  });

  it("a thief skill row is not favorite by default; favorite true when the actor's favorites list it", () => {
    const notFav = buildCharacterSheetContext(input({ classItems: [thiefClass] }));
    expect(notFav.skills.thief!.items.find((r) => r.skill === "pick-pockets")!.favorite).toBe(false);
    const fav = buildCharacterSheetContext(
      input({ classItems: [thiefClass], favorites: [{ kind: "thiefSkill", id: "pick-pockets" }] }),
    );
    expect(fav.skills.thief!.items.find((r) => r.skill === "pick-pockets")!.favorite).toBe(true);
  });
});

describe("sub-ability rows (SP8a)", () => {
  type AbilitySource = { score: number; exceptional: number | null; sub?: { a: number | null; b: number | null } };
  function withSubs(subs: Record<string, { a: number | null; b: number | null }>): CharacterSheetInput["source"] {
    const src = JSON.parse(JSON.stringify(input().source)) as { system: { abilities: Record<string, AbilitySource> } };
    for (const [k, sub] of Object.entries(subs)) src.system.abilities[k]!.sub = sub;
    return src as unknown as CharacterSheetInput["source"];
  }
  const allSet = { a: 10, b: 10 };
  const everyAbility = { str: allSet, dex: allSet, con: allSet, int: allSet, wis: allSet, cha: allSet };

  it("rule off (subAbilityUi absent): no sub cells, main score unlocked and authored, nothing to seed", () => {
    const c = buildCharacterSheetContext(input());
    for (const row of c.abilities) {
      expect(row.subs).toBeNull();
      expect(row.scoreLocked).toBe(false);
    }
    expect(c.abilities.find((a) => a.key === "str")!.score).toBe(17);
    expect(c.subAbilities).toEqual({ enabled: false, canSeed: false });
  });

  it("rule on, no sub keys in the source: cells are empty with the authored score as placeholder; main falls back to authored", () => {
    const c = buildCharacterSheetContext(input({ subAbilityUi: true }));
    const str = c.abilities.find((a) => a.key === "str")!;
    expect(str.scoreLocked).toBe(true);
    expect(str.score).toBe(17);
    expect(str.subs).toEqual([
      { id: "muscle", label: "ADND2E.sheet.subAbilities.muscle", name: "system.abilities.str.sub.a", value: null, placeholder: 17 },
      { id: "stamina", label: "ADND2E.sheet.subAbilities.stamina", name: "system.abilities.str.sub.b", value: null, placeholder: 17 },
    ]);
    expect(c.subAbilities).toEqual({ enabled: true, canSeed: true });
  });

  it("rule on, authored sub-scores: displayed main score is their average; the delta is measured from it", () => {
    const c = buildCharacterSheetContext(
      input({ subAbilityUi: true, source: withSubs({ str: { a: 18, b: 14 } }) }),
    );
    const str = c.abilities.find((a) => a.key === "str")!;
    expect(str.score).toBe(16); // (18 + 14) / 2
    expect(str.effectiveScore).toBe(17); // derived fixture value
    // 17 - 16, NOT 17 - authored 17. No race is configured (human, no STR
    // delta), so the whole gap attributes to traitDelta, not racialDelta.
    expect(str.racialDelta).toBe(0);
    expect(str.traitDelta).toBe(1);
    expect(str.subs!.map((s) => s.value)).toEqual([18, 14]);
  });

  it("exceptional Strength keys off the effective score, itself derived from the averaged main score", () => {
    const c = buildCharacterSheetContext(
      input({
        subAbilityUi: true,
        source: withSubs({ str: { a: 18, b: 18 } }),
        // In real play deriveCharacter's own sub-score averaging feeds
        // straight into the effective score it then prepares from; this
        // mock's derived block is independent of source, so it's set here to
        // match what that average would actually produce (18) with no
        // race/trait adjustment on top.
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, str: { score: 18, mods: input().derived.abilities.str.mods } },
        },
      }),
    );
    expect(c.abilities.find((a) => a.key === "str")!.showExceptional).toBe(true); // authored 17, averaged 18
  });

  it("canSeed is false once every sub-score of every ability is authored", () => {
    const c = buildCharacterSheetContext(input({ subAbilityUi: true, source: withSubs(everyAbility) }));
    expect(c.subAbilities).toEqual({ enabled: true, canSeed: false });
  });

  it("canSeed is true while any single sub-score is still null", () => {
    const c = buildCharacterSheetContext(
      input({ subAbilityUi: true, source: withSubs({ ...everyAbility, cha: { a: 10, b: null } }) }),
    );
    expect(c.subAbilities.canSeed).toBe(true);
  });

  it("canSeed is false for a viewer who cannot edit, even with unset sub-scores", () => {
    const c = buildCharacterSheetContext(
      input({ subAbilityUi: true, perms: { isGM: false, isOwner: false, editable: false } }),
    );
    expect(c.subAbilities).toEqual({ enabled: true, canSeed: false });
  });
});

describe("buildCharacterSheetContext — traits + character points (SP8 Plan 8c)", () => {
  const ON = { ...DEFAULT_OPTIONAL_RULES, skillsAndPowersEnabled: true, characterPointBuild: true };
  const fx = (over: Partial<RawTraitEffect> = {}): RawTraitEffect => ({ kind: "bonusHp", ability: "", save: "", mode: "", track: "", amount: 4, ...over });
  const trait = (over: Partial<TraitItemView> = {}): TraitItemView => ({ id: "t1", name: "Hardy", img: "", traitId: "hardy", cost: 6, effect: fx(), ...over });
  /** the fixture source with `system` keys merged in */
  function src(sys: Record<string, unknown>): Record<string, unknown> {
    const s = input().source as { system: Record<string, unknown> };
    return { ...s, system: { ...s.system, ...sys } };
  }
  const abilitiesWithStrSubs = () => {
    const a = (input().source as { system: { abilities: Record<string, unknown> } }).system.abilities;
    return { ...a, str: { ...(a.str as object), sub: { a: 18, b: 14 } } };
  };

  it("is disabled with no ledger and no rows while the rule is off — in each off combination, even with traits owned", () => {
    for (const rules of [
      DEFAULT_OPTIONAL_RULES,
      { ...DEFAULT_OPTIONAL_RULES, skillsAndPowersEnabled: true },
      { ...DEFAULT_OPTIONAL_RULES, characterPointBuild: true },
    ]) {
      const t = buildCharacterSheetContext(input({ optionalRules: rules, traitItems: [trait()] })).traits;
      expect(t.enabled).toBe(false);
      expect(t.ledger).toBeNull();
      expect(t.rows).toEqual([]);
      expect(t.refundCapped).toBe(false);
    }
  });

  it("rule on, nothing owned and no options in the source: the default 60-point pool is all available", () => {
    const t = buildCharacterSheetContext(input({ optionalRules: ON })).traits;
    expect(t.enabled).toBe(true);
    expect(t.pool).toBe(60);
    expect(t.rows).toEqual([]);
    expect(t.ledger).toMatchObject({ pool: 60, spent: 0, available: 60, overspent: false });
  });

  it("reads the authored pool from the source", () => {
    const source = src({ options: { skillsAndPowers: { characterPoints: { pool: 45 } } } });
    const t = buildCharacterSheetContext(input({ optionalRules: ON, source })).traits;
    expect(t.pool).toBe(45);
    expect(t.ledger!.available).toBe(45);
  });

  it("builds a row with a signed amount and the target key, and charges the ledger", () => {
    const t = buildCharacterSheetContext(input({ optionalRules: ON, traitItems: [trait()] })).traits;
    expect(t.rows).toEqual([
      { id: "t1", name: "Hardy", img: "", cost: 6, active: true, summaryAmount: "+4", summaryTargetKey: "ADND2E.sheet.traits.target.hp", canRemove: true },
    ]);
    expect(t.ledger).toMatchObject({ spent: 6, available: 54 });
  });

  it("maps every effect kind to its target key (ability/save labels come from the config)", () => {
    const rows = buildCharacterSheetContext(
      input({
        optionalRules: ON,
        traitItems: [
          trait({ id: "a", effect: fx({ kind: "abilityBonus", ability: "str", amount: 1 }) }),
          trait({ id: "b", effect: fx({ kind: "saveBonus", save: "spell", amount: -1 }) }),
          trait({ id: "c", effect: fx({ kind: "attackBonus", mode: "ranged", amount: 1 }) }),
          trait({ id: "d", effect: fx({ kind: "proficiencySlots", track: "weapon", amount: 2 }) }),
          trait({ id: "e", effect: fx({ kind: "bonusHp", amount: 0 }) }),
        ],
      }),
    ).traits.rows;
    expect(rows.map((r) => [r.summaryAmount, r.summaryTargetKey])).toEqual([
      ["+1", "ADND2E.abilities.str"],
      ["-1", "ADND2E.saves.spell"],
      ["+1", "ADND2E.sheet.traits.mode.ranged"],
      ["+2", "ADND2E.sheet.traits.track.weapon"],
      ["0", "ADND2E.sheet.traits.target.hp"],
    ]);
    expect(rows.every((r) => r.active)).toBe(true);
  });

  it("shows a malformed trait as inert while still charging its cost", () => {
    const t = buildCharacterSheetContext(input({ optionalRules: ON, traitItems: [trait({ cost: 5, effect: fx({ kind: "" }) })] })).traits;
    expect(t.rows[0]).toMatchObject({ active: false, summaryAmount: "—", summaryTargetKey: "ADND2E.sheet.traits.target.none" });
    expect(t.ledger!.spent).toBe(5);
  });

  it("counts authored sub-scores in the ledger only when sub-ability scores are also on", () => {
    const source = src({ abilities: abilitiesWithStrSubs() });
    const off = buildCharacterSheetContext(input({ optionalRules: ON, source })).traits;
    expect(off.ledger!.subSpent).toBe(0);
    const on = buildCharacterSheetContext(input({ optionalRules: { ...ON, subAbilityScores: true }, source })).traits;
    expect(on.ledger!.subSpent).toBe(17);
    expect(on.ledger!.available).toBe(43);
  });

  it("flags overspend without hiding anything", () => {
    const source = src({ options: { skillsAndPowers: { characterPoints: { pool: 5 } } } });
    const t = buildCharacterSheetContext(input({ optionalRules: ON, source, traitItems: [trait({ cost: 8 })] })).traits;
    expect(t.ledger).toMatchObject({ available: -3, overspent: true });
    expect(t.rows).toHaveLength(1);
  });

  it("flags a capped disadvantage refund only when the raw refund exceeds the cap", () => {
    const capped = buildCharacterSheetContext(
      input({ optionalRules: ON, traitItems: [trait({ id: "x", cost: -8 }), trait({ id: "y", cost: -5 })] }),
    ).traits;
    expect(capped.ledger).toMatchObject({ refund: 10, refundUncapped: 13 });
    expect(capped.refundCapped).toBe(true);
    const under = buildCharacterSheetContext(input({ optionalRules: ON, traitItems: [trait({ cost: -4 })] })).traits;
    expect(under.refundCapped).toBe(false);
  });

  it("only a GM who can edit may change the pool; anyone who can edit may remove a trait", () => {
    const rules = { optionalRules: ON, traitItems: [trait()] };
    const gm = buildCharacterSheetContext(input({ ...rules, perms: { isGM: true, isOwner: true, editable: true } })).traits;
    expect([gm.canEditPool, gm.rows[0].canRemove]).toEqual([true, true]);
    const player = buildCharacterSheetContext(input({ ...rules, perms: { isGM: false, isOwner: true, editable: true } })).traits;
    expect([player.canEditPool, player.rows[0].canRemove]).toEqual([false, true]);
    const viewer = buildCharacterSheetContext(input({ ...rules, perms: { isGM: true, isOwner: false, editable: false } })).traits;
    expect([viewer.canEditPool, viewer.rows[0].canRemove]).toEqual([false, false]);
  });
});

describe("buildCharacterSheetContext — casting (SP9a)", () => {
  const status = (over: Partial<CastingStatusInput> = {}): CastingStatusInput => ({
    spellName: "Fireball",
    startRound: 2,
    completeRound: 3,
    segments: null,
    combatRound: 2,
    isCasterTurn: false,
    ...over,
  });
  const spell = (over: Partial<SpellItemView> = {}): SpellItemView => ({
    id: "s1", name: "Magic Missile", img: "", casterClass: "wizard", level: 1,
    schools: ["evocation"], spheres: [], range: "", castingTime: "1", savingThrow: "none",
    inSpellbook: true, memorized: false, expended: false, canMemorize: false, canCast: false, canLearn: false,
    favorite: false,
    ...over,
  });
  const memorizedWizard = () => {
    const d = input().derived;
    return {
      ...d,
      spellcasting: {
        ...d.spellcasting,
        wizard: { ...d.spellcasting.wizard, slots: { 1: { max: 1, used: 1 } }, memorized: [{ spellItemId: "s1", spellLevel: 1, expended: false }] },
      },
    };
  };

  it("with no casting status: no panel, no badge, and a memorized spell stays castable", () => {
    const c = buildCharacterSheetContext(input({ derived: memorizedWizard(), spellItems: [spell()] }));
    expect(c.spells.casting).toBeNull();
    expect(c.vitals.casting).toBe(false);
    expect(c.spells.known[0].items[0].canCast).toBe(true);
  });

  it("while casting: shows the panel and badge and hides every Cast button", () => {
    const c = buildCharacterSheetContext(input({ derived: memorizedWizard(), spellItems: [spell()], castingStatus: status() }));
    expect(c.vitals.casting).toBe(true);
    expect(c.spells.known[0].items[0].canCast).toBe(false);
    expect(c.spells.casting).toEqual({
      spellName: "Fireball",
      detailKey: "ADND2E.sheet.casting.completesRound",
      detailValue: 3,
      canComplete: false,
      canGmControl: true,
    });
  });

  it("a round spell can be completed from its complete round", () => {
    const c = buildCharacterSheetContext(input({ castingStatus: status({ combatRound: 3 }) }));
    expect(c.spells.casting!.canComplete).toBe(true);
  });

  it("a segment spell shows its initiative addition and completes on the caster's turn", () => {
    const seg = status({ completeRound: null, segments: 3 });
    const waiting = buildCharacterSheetContext(input({ castingStatus: seg })).spells.casting!;
    expect(waiting).toMatchObject({ detailKey: "ADND2E.sheet.casting.onYourTurn", detailValue: 3, canComplete: false });
    expect(buildCharacterSheetContext(input({ castingStatus: { ...seg, isCasterTurn: true } })).spells.casting!.canComplete).toBe(true);
  });

  it("a segment spell with no recorded segments shows 0", () => {
    const c = buildCharacterSheetContext(input({ castingStatus: status({ completeRound: null, segments: null }) }));
    expect(c.spells.casting!.detailValue).toBe(0);
  });

  it("cannot be completed outside a started combat (combatRound null) or by a viewer who cannot edit", () => {
    expect(buildCharacterSheetContext(input({ castingStatus: status({ combatRound: null }) })).spells.casting!.canComplete).toBe(false);
    const viewer = input({ castingStatus: status({ combatRound: 3 }), perms: { isGM: false, isOwner: false, editable: false } });
    expect(buildCharacterSheetContext(viewer).spells.casting).toMatchObject({ canComplete: false, canGmControl: false });
  });
});

describe("buildCharacterSheetContext — sheet redesign R1 fields", () => {
  it("is locked by default; only an editor can unlock", () => {
    expect(buildCharacterSheetContext(input()).lock).toEqual({ canUnlock: true, unlocked: false });
    expect(buildCharacterSheetContext(input({ unlocked: true })).lock).toEqual({ canUnlock: true, unlocked: true });
    const viewer = input({ unlocked: true, perms: { isGM: false, isOwner: false, editable: false } });
    expect(buildCharacterSheetContext(viewer).lock).toEqual({ canUnlock: false, unlocked: false });
  });

  it("only owners can favorite; favorites build rows and flag the matching rows", () => {
    const sword: PhysicalItemView = {
      id: "w1", name: "Long Sword", img: "s.png", type: "weapon", quantity: 1, weight: 4, totalWeight: 4,
      location: "", equipped: true, identified: true, magicBonus: 0, isContainer: false, capacity: null,
      contentsWeightMultiplier: 1,
      weapon: { damageVsSM: "1d8", damageVsL: "1d12", speedFactor: 5, range: null, category: "melee", baseWeaponName: "", proficiencyGroup: "", specialistWeaponClass: "", damageType: "slashing", ammoType: null, selectedAmmoId: null },
    };
    const c = buildCharacterSheetContext(input({ physicalItems: [sword], favorites: [{ kind: "item", id: "w1" }] }));
    expect(c.favorites.canFavorite).toBe(true);
    expect(c.favorites.rows).toEqual([
      { kind: "item", id: "w1", name: "Long Sword", img: "s.png", nameIsKey: false, detail: "", action: "rollAttack", itemId: "w1", skill: null, icon: "fa-solid fa-dice-d20" },
    ]);
    expect(c.combat.weapons.find((w) => w.id === "w1")!.favorite).toBe(true);
    expect(c.inventory.sections[0]).toMatchObject({ id: "weapons", rows: [{ favorite: true }] });

    const stranger = buildCharacterSheetContext(
      input({ physicalItems: [sword], favorites: [{ kind: "item", id: "w1" }], perms: { isGM: false, isOwner: false, editable: false } }),
    );
    expect(stranger.favorites.canFavorite).toBe(false);
  });

  it("with no favorites flag the panel is empty and nothing is flagged", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.favorites.rows).toEqual([]);
    expect(c.inventory.sections.map((s) => s.id)).toEqual(["weapons", "armor", "equipment", "ammo"]);
  });

  it("a favorited thief skill's one-click action is disabled when worn armor disables thief skills", () => {
    const thiefClass = {
      id: "c1", name: "Thief", img: "", chassisId: "thief", hitDie: 6,
      xp: 0, level: 1, canLevelUp: false, dualClassState: null, specialistSchool: null,
    };
    const chainMail: PhysicalItemView = {
      id: "a1", name: "Chain Mail", img: "", type: "armor",
      quantity: 1, weight: 40, totalWeight: 40, location: "", equipped: true, identified: true, magicBonus: 0,
      isContainer: false, capacity: null, contentsWeightMultiplier: 1,
      armor: { baseAc: 5, isShield: false, shieldAcBonus: 0, armorType: "chain-mail" },
    };
    const disabled = buildCharacterSheetContext(
      input({
        classItems: [thiefClass],
        physicalItems: [chainMail],
        favorites: [{ kind: "thiefSkill", id: "pick-pockets" }],
      }),
    );
    expect(disabled.skills.thief!.armorDisabled).toBe(true);
    const disabledRow = disabled.favorites.rows.find((r) => r.kind === "thiefSkill")!;
    expect(disabledRow.action).toBeNull();
    expect(disabledRow.icon).toBe("");

    // same favorite, no armor worn: the section isn't disabled, so the row keeps its action + icon.
    const usable = buildCharacterSheetContext(
      input({ classItems: [thiefClass], favorites: [{ kind: "thiefSkill", id: "pick-pockets" }] }),
    );
    expect(usable.skills.thief!.armorDisabled).toBe(false);
    const usableRow = usable.favorites.rows.find((r) => r.kind === "thiefSkill")!;
    expect(usableRow.action).toBe("rollThiefSkill");
    expect(usableRow.icon).toBe("fa-solid fa-dice-d20");

    // a skill that's independently not-usable (read-languages, level < 4) stays disabled
    // regardless of armor — covers the `t.usable` side of the combined check.
    const notUsable = buildCharacterSheetContext(
      input({ classItems: [thiefClass], favorites: [{ kind: "thiefSkill", id: "read-languages" }] }),
    );
    const notUsableRow = notUsable.favorites.rows.find((r) => r.kind === "thiefSkill")!;
    expect(notUsableRow.action).toBeNull();
    expect(notUsableRow.icon).toBe("");
  });
});

describe("buildCharacterSheetContext — wizard spell points (SP14a)", () => {
  const spellPointsRules = { ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true, spellPoints: true };
  const withSpellPoints = (over: Record<string, unknown> = {}) => ({
    ...input().derived,
    spellcasting: {
      wizard: {
        specialistSchool: null,
        slots: {},
        spellPoints: { maxSpellLevel: 2, maxPerLevel: 3, sp: 15, spent: 4, remaining: 11 },
        memorized: [{ spellItemId: "s1", spellLevel: 1, expended: false, magickType: "fixed" as const }],
        ...over,
      },
      priest: { slots: {}, memorized: [], sphereAccessOverride: null },
    },
  });
  const spell = (over: Record<string, unknown> = {}) => ({
    id: "s1", name: "Magic Missile", img: "", casterClass: "wizard", level: 1,
    schools: ["evocation"], spheres: [], range: "", castingTime: "1", savingThrow: "none",
    inSpellbook: true, memorized: false, expended: false, canMemorize: false, canCast: false, canLearn: false,
    favorite: false,
    ...over,
  });

  it("rule off: no SP bar, no free magicks", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.spells.spellPoints).toBeNull();
    expect(c.spells.freeMagicks).toEqual([]);
  });

  it("rule on: exposes the SP bar", () => {
    const c = buildCharacterSheetContext(input({ derived: withSpellPoints(), optionalRules: spellPointsRules }));
    expect(c.spells.spellPoints).toEqual({ max: 15, spent: 4, remaining: 11 });
  });

  it("lists each memorized free magick, expended or not (independent of the rule's current on/off state — see plan's Locked design decisions)", () => {
    const derived = withSpellPoints({
      memorized: [
        { spellItemId: "s1", spellLevel: 1, expended: false, magickType: "fixed" as const },
        { spellItemId: null, spellLevel: 2, expended: false, magickType: "free" as const },
        { spellItemId: null, spellLevel: 2, expended: true, magickType: "free" as const },
      ],
    });
    const c = buildCharacterSheetContext(input({ derived, spellItems: [spell()], optionalRules: spellPointsRules }));
    expect(c.spells.freeMagicks).toEqual([
      { level: 2, expended: false, canCast: true },
      { level: 2, expended: true, canCast: false },
    ]);
  });

  it("a free magick's canCast is false while a classic multi-round cast is in progress", () => {
    const derived = withSpellPoints({
      memorized: [{ spellItemId: null, spellLevel: 2, expended: false, magickType: "free" }],
    });
    const status = {
      spellName: "Fireball", startRound: 1, completeRound: 3, segments: null, combatRound: 1, isCasterTurn: false,
    };
    const c = buildCharacterSheetContext(input({ derived, spellItems: [spell()], optionalRules: spellPointsRules, castingStatus: status }));
    expect(c.spells.freeMagicks[0]!.canCast).toBe(false);
  });

  it("a fixed-magick row's canMemorize gates on the flat per-level cap and remaining SP, not the classic SlotRecord", () => {
    const derived = withSpellPoints({ spellPoints: { maxSpellLevel: 2, maxPerLevel: 1, sp: 15, spent: 4, remaining: 11 }, memorized: [] });
    const atCap = buildCharacterSheetContext(
      input({
        derived: { ...derived, spellcasting: { ...derived.spellcasting, wizard: { ...derived.spellcasting.wizard, memorized: [{ spellItemId: "other", spellLevel: 1, expended: false, magickType: "fixed" as const }] } } },
        spellItems: [spell()],
        optionalRules: spellPointsRules,
      }),
    );
    expect(atCap.spells.known[0].items[0].canMemorize).toBe(false); // maxPerLevel 1, already 1 held at level 1

    const tooPoor = buildCharacterSheetContext(
      input({
        derived: { ...derived, spellcasting: { ...derived.spellcasting, wizard: { ...derived.spellcasting.wizard, spellPoints: { maxSpellLevel: 2, maxPerLevel: 3, sp: 3, spent: 0, remaining: 3 } } } },
        spellItems: [spell()],
        optionalRules: spellPointsRules,
      }),
    );
    expect(tooPoor.spells.known[0].items[0].canMemorize).toBe(false); // needs 4 SP (level 1 fixed), only 3 available

    const affordable = buildCharacterSheetContext(
      input({
        derived: { ...derived, spellcasting: { ...derived.spellcasting, wizard: { ...derived.spellcasting.wizard, spellPoints: { maxSpellLevel: 2, maxPerLevel: 3, sp: 4, spent: 0, remaining: 4 } } } },
        spellItems: [spell()],
        optionalRules: spellPointsRules,
      }),
    );
    expect(affordable.spells.known[0].items[0].canMemorize).toBe(true); // exactly 4 SP for a level-1 fixed magick, room under the cap
  });
});

describe("buildCharacterSheetContext — priest spell points (SP14 priest)", () => {
  const priestRules = { ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true, spellPoints: true };
  const clericClass = {
    id: "c1", name: "Cleric", img: "", chassisId: "cleric", hitDie: 8,
    xp: 0, level: 5, canLevelUp: false, dualClassState: null, specialistSchool: null,
  };
  /** A L5 cleric whose priest pool has `remaining` SP left out of 40 (spent is the rest). */
  const priestInputWithPool = (
    pool: { remaining: number; maxPerLevel?: number; memorized?: unknown[]; channelling?: { current: number; max: number } },
    over: Partial<CharacterSheetInput> = {},
  ): CharacterSheetInput => {
    const base = input();
    return input({
      classItems: [clericClass],
      derived: {
        ...base.derived,
        spellcasting: {
          wizard: { specialistSchool: null, slots: {}, memorized: [] },
          priest: {
            slots: { "1": { max: 2, used: 0 } },
            spellPoints: { maxSpellLevel: 7, maxPerLevel: pool.maxPerLevel ?? 10, sp: 40, spent: 40 - pool.remaining, remaining: pool.remaining },
            memorized: (pool.memorized ?? []) as never,
            sphereAccessOverride: null,
            channelling: pool.channelling,
          },
        },
      },
      optionalRules: priestRules,
      ...over,
    });
  };
  const priestSpell = (over: Partial<SpellItemView>): SpellItemView => ({
    id: "clw", name: "Cure Light Wounds", img: "", casterClass: "priest", level: 1,
    schools: [], spheres: ["healing"], range: "", castingTime: "", savingThrow: "none",
    inSpellbook: false, memorized: false, expended: false, canMemorize: false, canCast: false, canLearn: false,
    favorite: false,
    ...over,
  });

  it("rule off: no priest SP bar and no priest free-theurgy controls", () => {
    const c = buildCharacterSheetContext(priestInputWithPool({ remaining: 3 }, { optionalRules: DEFAULT_OPTIONAL_RULES }));
    expect(c.spells.priestSpellPoints).toBeNull();
    expect(c.spells.priestFreeMemorize).toEqual([]);
  });

  // A 3rd-level cleric (3000 XP): Table 26 max per level 5, so the orison cap is 10.
  const cleric3 = { ...clericClass, xp: 3000 };

  it("lists a level-0 priest spell under orisons with canMemorize while under the cap", () => {
    const c = buildCharacterSheetContext(
      priestInputWithPool(
        { remaining: 5, maxPerLevel: 5 },
        { classItems: [cleric3], spellItems: [priestSpell({ id: "o1", level: 0, name: "Alleviate" })] },
      ),
    );
    expect(c.spells.orisons.map((r) => r.name)).toEqual(["Alleviate"]);
    expect(c.spells.orisons[0]!.canMemorize).toBe(true);
    expect(c.spells.known.flatMap((g) => g.items).some((r) => r.level === 0)).toBe(false);
  });

  it("refuses an orison once the orison cap (2 x maxPerLevel) is full, even with SP to spare", () => {
    const full = Array.from({ length: 10 }, (_, i) => ({
      spellItemId: `o${i}`, spellLevel: 0, expended: false, magickType: "fixed", theurgyScope: "universal",
    }));
    const c = buildCharacterSheetContext(
      priestInputWithPool(
        { remaining: 40, maxPerLevel: 5, memorized: full },
        { classItems: [cleric3], spellItems: [priestSpell({ id: "o11", level: 0, name: "Light 11" })] },
      ),
    );
    expect(c.spells.orisons[0]!.canMemorize).toBe(false);
  });

  it("a memorized, unexpended orison can be cast; once expended it cannot", () => {
    const memorizedOrison = (expended: boolean) =>
      buildCharacterSheetContext(
        priestInputWithPool(
          { remaining: 40, memorized: [{ spellItemId: "o1", spellLevel: 0, expended, magickType: "fixed" }] },
          { classItems: [cleric3], spellItems: [priestSpell({ id: "o1", level: 0, name: "Alleviate" })] },
        ),
      ).spells.orisons[0]!;
    expect(memorizedOrison(false)).toMatchObject({ memorized: true, expended: false, canCast: true });
    expect(memorizedOrison(true)).toMatchObject({ memorized: true, expended: true, canCast: false });
  });

  it("shows no orisons with the rule off", () => {
    const c = buildCharacterSheetContext(priestInputWithPool({ remaining: 5 }, { optionalRules: DEFAULT_OPTIONAL_RULES, spellItems: [priestSpell({ level: 0 })] }));
    expect(c.spells.orisons).toEqual([]);
  });

  it("shows the priest SP bar with the pool's max, spent and remaining", () => {
    const c = buildCharacterSheetContext(priestInputWithPool({ remaining: 3 }));
    expect(c.spells.priestSpellPoints).toEqual({ max: 40, spent: 37, remaining: 3 });
  });

  // Channellers on: a channelled priest memorizes free (caps only) and casts from channelling.current.
  const channelledRules = { ...priestRules, channelers: true };
  const clwMemorized = [{ spellItemId: "clw", spellLevel: 1, expended: false, magickType: "fixed", theurgyScope: "major" }];

  it("a channelling priest can memorize a theurgy the pool cannot cover (caps only)", () => {
    const c = buildCharacterSheetContext(
      priestInputWithPool({ remaining: 0, channelling: { current: 0, max: 40 } }, { optionalRules: channelledRules, spellItems: [priestSpell({})] }),
    );
    expect(c.spells.known[0]!.items.find((r) => r.name === "Cure Light Wounds")!.canMemorize).toBe(true);
  });

  it("a channelling priest's memorized CLW canCast is false when channelling.current is below its 4 SP cost", () => {
    const row = (current: number) =>
      buildCharacterSheetContext(
        priestInputWithPool(
          { remaining: 40, memorized: clwMemorized, channelling: { current, max: 40 } },
          { optionalRules: channelledRules, spellItems: [priestSpell({ memorized: true })] },
        ),
      ).spells.known[0]!.items.find((r) => r.name === "Cure Light Wounds")!;
    expect(row(3).canCast).toBe(false);
    expect(row(4).canCast).toBe(true);
  });

  it("a channelling priest's memorized orison canCast follows affordability at 1 SP, and its memorize ignores the pool", () => {
    const orison = (current: number) =>
      buildCharacterSheetContext(
        priestInputWithPool(
          { remaining: 0, memorized: [{ spellItemId: "o1", spellLevel: 0, expended: false, magickType: "fixed", theurgyScope: "universal" }], channelling: { current, max: 40 } },
          { classItems: [cleric3], optionalRules: channelledRules, spellItems: [priestSpell({ id: "o1", level: 0, name: "Alleviate" })] },
        ),
      ).spells.orisons[0]!;
    expect(orison(0).canCast).toBe(false);
    expect(orison(1).canCast).toBe(true);
  });

  it("disables a priest spell row the pool cannot afford (1st-level major fixed costs 4 > remaining 3)", () => {
    const c = buildCharacterSheetContext(priestInputWithPool({ remaining: 3 }, { spellItems: [priestSpell({})] }));
    const row = c.spells.known[0]!.items.find((r) => r.name === "Cure Light Wounds");
    expect(row!.canMemorize).toBe(false);
  });

  it("enables the same priest spell row when the pool affords the Table 29 cost and the cap has room", () => {
    const c = buildCharacterSheetContext(priestInputWithPool({ remaining: 40 }, { spellItems: [priestSpell({})] }));
    const row = c.spells.known[0]!.items.find((r) => r.name === "Cure Light Wounds");
    expect(row!.canMemorize).toBe(true);
  });

  it("disables a priest spell row once the per-level cap is reached, even with SP to spare", () => {
    const c = buildCharacterSheetContext(
      priestInputWithPool(
        { remaining: 40, maxPerLevel: 1, memorized: [{ spellItemId: "other", spellLevel: 1, expended: false, magickType: "fixed" }] },
        { spellItems: [priestSpell({})] },
      ),
    );
    expect(c.spells.known[0]!.items[0]!.canMemorize).toBe(false);
  });

  it("paladin under the rule keeps its classic slot table and a Memorize button (no pool)", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [{ ...clericClass, id: "p1", name: "Paladin", chassisId: "paladin" }],
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: {}, memorized: [] },
            priest: { slots: { "1": { max: 2, used: 0 } }, memorized: [], sphereAccessOverride: null },
          },
        },
        optionalRules: priestRules,
        spellItems: [priestSpell({})],
      }),
    );
    expect(c.spells.priestSlots).toEqual([{ level: 1, max: 2, used: 0 }]);
    expect(c.spells.priestSpellPoints).toBeNull();
    expect(c.spells.known[0]!.items[0]!.canMemorize).toBe(true);
  });

  it("priest row inside the sphere access is not flagged outsideSpheres", () => {
    const c = buildCharacterSheetContext(priestInputWithPool({ remaining: 40 }, { spellItems: [priestSpell({})] }));
    expect(c.spells.known[0]!.items[0]!.outsideSpheres).toBe(false);
  });

  it("priest row outside the sphere access (plant, not in the cleric table) is flagged outsideSpheres", () => {
    const c = buildCharacterSheetContext(
      priestInputWithPool({ remaining: 40 }, { spellItems: [priestSpell({ id: "plant1", name: "Entangle", spheres: ["plant"] })] }),
    );
    expect(c.spells.known[0]!.items[0]!.outsideSpheres).toBe(true);
  });

  it("an already-memorized priest row is never flagged outsideSpheres", () => {
    const c = buildCharacterSheetContext(
      priestInputWithPool(
        { remaining: 40, memorized: [{ spellItemId: "plant1", spellLevel: 1, expended: false, magickType: "fixed" }] },
        { spellItems: [priestSpell({ id: "plant1", name: "Entangle", spheres: ["plant"] })] },
      ),
    );
    expect(c.spells.known[0]!.items[0]!.outsideSpheres).toBe(false);
  });

  it("a wizard row is never flagged outsideSpheres (the flag is priest-only)", () => {
    const c = buildCharacterSheetContext(
      priestInputWithPool(
        { remaining: 40 },
        { spellItems: [{ ...priestSpell({ id: "plant1", name: "Entangle", spheres: ["plant"] }), casterClass: "wizard" }] },
      ),
    );
    expect(c.spells.known[0]!.items[0]!.outsideSpheres).toBe(false);
  });

  it("cleric under the rule still uses the pool: classic slot rows hidden, pool row shown", () => {
    const c = buildCharacterSheetContext(priestInputWithPool({ remaining: 40 }, { spellItems: [priestSpell({})] }));
    expect(c.spells.priestSlots).toEqual([]);
    expect(c.spells.priestSpellPoints).toEqual({ max: 40, spent: 0, remaining: 40 });
  });

  it("hides the priest classic slot rows when the rule is on", () => {
    const on = buildCharacterSheetContext(priestInputWithPool({ remaining: 40 }));
    expect(on.spells.priestSlots).toEqual([]);
    const off = buildCharacterSheetContext(priestInputWithPool({ remaining: 40 }, { optionalRules: DEFAULT_OPTIONAL_RULES }));
    expect(off.spells.priestSlots).toEqual([{ level: 1, max: 2, used: 0 }]);
  });

  it("offers a major and/or universal free-theurgy memorize per level the pool can afford (Table 29 free costs)", () => {
    // remaining 40: major free costs 8/12/20/30 for levels 1-4 (affordable), universal 12/20/30/44 (affordable only to level 3)
    const c = buildCharacterSheetContext(priestInputWithPool({ remaining: 40 }));
    expect(c.spells.priestFreeMemorize).toEqual([
      { level: 1, major: true, universal: true },
      { level: 2, major: true, universal: true },
      { level: 3, major: true, universal: true },
      { level: 4, major: true, universal: false },
    ]);
  });

  it("a cleric with no major sphere access is offered no major free theurgy, but universal is still offered", () => {
    const base = priestInputWithPool({ remaining: 40 });
    const c = buildCharacterSheetContext({
      ...base,
      derived: {
        ...base.derived,
        spellcasting: {
          ...base.derived.spellcasting,
          priest: { ...base.derived.spellcasting.priest, sphereAccessOverride: [] },
        },
      },
    });
    expect(c.spells.priestFreeMemorize.every((m) => m.major === false)).toBe(true);
    expect(c.spells.priestFreeMemorize.find((m) => m.level === 1)).toEqual({ level: 1, major: false, universal: true });
  });

  it("lists each memorized free theurgy with its scope, expended state and cast availability; fixed entries are not listed", () => {
    const c = buildCharacterSheetContext(
      priestInputWithPool({
        remaining: 40,
        memorized: [
          { spellItemId: null, spellLevel: 2, expended: false, magickType: "free", theurgyScope: "major" },
          { spellItemId: null, spellLevel: 3, expended: true, magickType: "free", theurgyScope: "universal" },
          { spellItemId: "clw", spellLevel: 1, expended: false, magickType: "fixed", theurgyScope: "major" },
        ],
      }, { spellItems: [priestSpell({ id: "heal2", level: 2, spheres: ["healing"] })] }),
    );
    expect(c.spells.priestFreeTheurgies).toEqual([
      { level: 2, scope: "major", scopeLabelKey: "ADND2E.sheet.spells.freeTheurgyMajor", expended: false, canCast: true, noEligibleSpell: false },
      { level: 3, scope: "universal", scopeLabelKey: "ADND2E.sheet.spells.freeTheurgyUniversal", expended: true, canCast: false, noEligibleSpell: false },
    ]);
  });

  it("a priest free theurgy's canCast is false while a classic multi-round cast is in progress", () => {
    const status = {
      spellName: "Fireball", startRound: 1, completeRound: 3, segments: null, combatRound: 1, isCasterTurn: false,
    };
    const c = buildCharacterSheetContext(
      priestInputWithPool(
        { remaining: 40, memorized: [{ spellItemId: null, spellLevel: 2, expended: false, magickType: "free", theurgyScope: "major" }] },
        { castingStatus: status },
      ),
    );
    expect(c.spells.priestFreeTheurgies[0]!.canCast).toBe(false);
  });

  it("a free major theurgy at level 2 cannot be cast with no eligible priest spell, and can once one exists", () => {
    const freeMajor2 = [{ spellItemId: null, spellLevel: 2, expended: false, magickType: "free" as const, theurgyScope: "major" as const }];
    const none = buildCharacterSheetContext(priestInputWithPool({ remaining: 40, memorized: freeMajor2 }));
    expect(none.spells.priestFreeTheurgies[0]!.canCast).toBe(false);
    expect(none.spells.priestFreeTheurgies[0]!.noEligibleSpell).toBe(true);
    const withOne = buildCharacterSheetContext(
      priestInputWithPool(
        { remaining: 40, memorized: freeMajor2 },
        { spellItems: [priestSpell({ id: "heal2", level: 2, spheres: ["healing"] })] },
      ),
    );
    expect(withOne.spells.priestFreeTheurgies[0]!.canCast).toBe(true);
    expect(withOne.spells.priestFreeTheurgies[0]!.noEligibleSpell).toBe(false);
  });

  it("noEligibleSpell is false for an expended or mid-cast row, even with no eligible spell", () => {
    const expended = buildCharacterSheetContext(
      priestInputWithPool({ remaining: 40, memorized: [{ spellItemId: null, spellLevel: 2, expended: true, magickType: "free", theurgyScope: "major" }] }),
    );
    expect(expended.spells.priestFreeTheurgies[0]!.noEligibleSpell).toBe(false);
    const casting = buildCharacterSheetContext(
      priestInputWithPool(
        { remaining: 40, memorized: [{ spellItemId: null, spellLevel: 2, expended: false, magickType: "free", theurgyScope: "major" }] },
        { castingStatus: { spellName: "Fireball", startRound: 1, completeRound: 3, segments: null, combatRound: 1, isCasterTurn: false } },
      ),
    );
    expect(casting.spells.priestFreeTheurgies[0]!.noEligibleSpell).toBe(false);
  });

  it("a free universal theurgy is castable with any priest spell of its level, even a minor-access one", () => {
    const c = buildCharacterSheetContext(
      priestInputWithPool(
        { remaining: 40, memorized: [{ spellItemId: null, spellLevel: 2, expended: false, magickType: "free", theurgyScope: "universal" }] },
        { spellItems: [priestSpell({ id: "el2", level: 2, spheres: ["elemental"] })] },
      ),
    );
    expect(c.spells.priestFreeTheurgies[0]!.canCast).toBe(true);
  });

  it("a free theurgy entry is never reported as an orphaned spell, even though it has no spell item", () => {
    const c = buildCharacterSheetContext(
      priestInputWithPool({
        remaining: 40,
        memorized: [{ spellItemId: null, spellLevel: 2, expended: false, magickType: "free", theurgyScope: "major" }],
      }),
    );
    expect(c.spells.orphaned).toEqual([]);
  });

  it("rule off with a free theurgy still held: no memorize controls, but the entry stays listed for Forget", () => {
    const c = buildCharacterSheetContext(
      priestInputWithPool(
        { remaining: 40, memorized: [{ spellItemId: null, spellLevel: 2, expended: false, magickType: "free", theurgyScope: "major" }] },
        { optionalRules: DEFAULT_OPTIONAL_RULES },
      ),
    );
    expect(c.spells.priestSpellPoints).toBeNull();
    expect(c.spells.priestFreeMemorize).toEqual([]);
    expect(c.spells.priestFreeTheurgies).toHaveLength(1);
  });
});

describe("buildCharacterSheetContext — Channellers (SP14b)", () => {
  const channellingRules = {
    ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true, spellPoints: true, channelers: true,
  };
  const withChannelling = (over: Record<string, unknown> = {}) => ({
    ...input().derived,
    spellcasting: {
      wizard: {
        specialistSchool: null,
        slots: {},
        spellPoints: { maxSpellLevel: 2, maxPerLevel: 3, sp: 15, spent: 0, remaining: 15 },
        channelling: { current: 8, max: 15 },
        memorized: [{ spellItemId: "s1", spellLevel: 1, expended: false, magickType: "fixed" as const }],
        ...over,
      },
      priest: { slots: {}, memorized: [], sphereAccessOverride: null },
    },
  });
  const spell = (over: Record<string, unknown> = {}) => ({
    id: "s1", name: "Magic Missile", img: "", casterClass: "wizard", level: 1,
    schools: ["evocation"], spheres: [], range: "", castingTime: "1", savingThrow: "none",
    inSpellbook: true, memorized: false, expended: false, canMemorize: false, canCast: false, canLearn: false,
    favorite: false,
    ...over,
  });

  it("rule off: no channelling bar, Plan A's spell-points bar still shows when that rule alone is on", () => {
    const spellPointsOnly = { ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true, spellPoints: true };
    const c = buildCharacterSheetContext(
      input({
        derived: withChannelling({ channelling: undefined }),
        optionalRules: spellPointsOnly,
      }),
    );
    expect(c.spells.channelling).toBeNull();
    expect(c.spells.spellPoints).toEqual({ max: 15, spent: 0, remaining: 15 });
  });

  it("rule on: exposes the channelling bar", () => {
    const c = buildCharacterSheetContext(input({ derived: withChannelling(), optionalRules: channellingRules }));
    expect(c.spells.channelling).toEqual({ current: 8, max: 15 });
  });

  it("memorizing a fixed magick needs no spell points when channelling — only the Table 17 caps", () => {
    const derived = withChannelling({
      spellPoints: { maxSpellLevel: 2, maxPerLevel: 1, sp: 0, spent: 0, remaining: 0 }, // 0 SP available
      channelling: { current: 0, max: 0 },
      memorized: [],
    });
    const c = buildCharacterSheetContext(
      input({ derived, spellItems: [spell()], optionalRules: channellingRules }),
    );
    expect(c.spells.known[0].items[0].canMemorize).toBe(true); // 0 SP is fine — memorizing is free for a channeller
  });

  it("a memorized fixed magick's canCast reflects live pool affordability, not expended", () => {
    const affordable = buildCharacterSheetContext(
      input({
        derived: withChannelling({ channelling: { current: 4, max: 15 } }),
        spellItems: [spell()],
        optionalRules: channellingRules,
      }),
    );
    expect(affordable.spells.known[0].items[0].canCast).toBe(true); // 4 SP available, level-1 fixed costs 4

    const tooPoor = buildCharacterSheetContext(
      input({
        derived: withChannelling({ channelling: { current: 3, max: 15 } }),
        spellItems: [spell()],
        optionalRules: channellingRules,
      }),
    );
    expect(tooPoor.spells.known[0].items[0].canCast).toBe(false); // needs 4, only 3 left
  });

  it("a channelling free magick's canCast reflects live pool affordability", () => {
    // Table 18: a level-2 free magick costs 12 SP.
    const tooPoor = buildCharacterSheetContext(
      input({
        derived: withChannelling({
          memorized: [{ spellItemId: null, spellLevel: 2, expended: false, magickType: "free" as const }],
          channelling: { current: 11, max: 15 },
        }),
        optionalRules: channellingRules,
      }),
    );
    expect(tooPoor.spells.freeMagicks).toEqual([{ level: 2, expended: false, canCast: false }]);

    const affordable = buildCharacterSheetContext(
      input({
        derived: withChannelling({
          memorized: [{ spellItemId: null, spellLevel: 2, expended: false, magickType: "free" as const }],
          channelling: { current: 12, max: 15 },
        }),
        optionalRules: channellingRules,
      }),
    );
    expect(affordable.spells.freeMagicks).toEqual([{ level: 2, expended: false, canCast: true }]);
  });
});

describe("buildCharacterSheetContext — Channellers fatigue (SP14c)", () => {
  it("no fatigue tier: vitals.fatigue is null, movement unaffected", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.vitals.fatigue).toBeNull();
  });

  it("a fatigue tier adjusts the displayed movement rate and exposes a label", () => {
    // the fixture's base movement.current is 12 (unencumbered) -> heavy is floor(12*0.25) = 3
    const c = buildCharacterSheetContext({ ...input(), fatigueTier: "heavy" });
    expect(c.vitals.movement.current).toBe(3);
    expect(c.vitals.fatigue).toEqual({ label: "Heavily Fatigued", hintKey: "ADND2E.sheet.spells.fatigueRecoveryHintTurn" });
  });

  it("severe fatigue is a flat movement rate of 1 regardless of the base rate", () => {
    const c = buildCharacterSheetContext({ ...input(), fatigueTier: "severe" });
    expect(c.vitals.movement.current).toBe(1);
  });

  it("mortal fatigue is a movement rate of 0", () => {
    const c = buildCharacterSheetContext({ ...input(), fatigueTier: "mortal" });
    expect(c.vitals.movement.current).toBe(0);
  });

  it("whole-branch review M2: canRecoverFatigue is false when fatigued but the channellerFatigue rule is off, even with every other channelling rule on", () => {
    const rulesWithFatigueOff = {
      ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true, spellPoints: true, channelers: true, channellerFatigue: false,
    };
    const c = buildCharacterSheetContext({ ...input(), fatigueTier: "heavy", optionalRules: rulesWithFatigueOff });
    expect(c.vitals.fatigue).not.toBeNull(); // the badge/panel still shows — a stale condition keeps affecting the sheet
    expect(c.vitals.canRecoverFatigue).toBe(false);
  });

  it("whole-branch review M2: canRecoverFatigue is true when the channellerFatigue rule is genuinely on", () => {
    const rulesWithFatigueOn = {
      ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true, spellPoints: true, channelers: true, channellerFatigue: true,
    };
    const c = buildCharacterSheetContext({ ...input(), fatigueTier: "heavy", optionalRules: rulesWithFatigueOn });
    expect(c.vitals.canRecoverFatigue).toBe(true);
  });
});

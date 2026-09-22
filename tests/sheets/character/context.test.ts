import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import { buildCharacterSheetContext } from "../../../src/sheets/character/context";
import type {
  CharacterSheetInput,
  FeatureItemView,
  NwpView,
  PhysicalItemView,
  SpellItemView,
  WeaponProfView,
} from "../../../src/sheets/character/context-types";

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
    expect(c.features.racialAbilities).toEqual(["infravision-60", "resist-sleep-charm"]);
  });
});

/* ----------------------------------------------------------------- abilities */

describe("buildCharacterSheetContext — abilities", () => {
  it("six rows, racial delta from source vs derived", () => {
    const c = buildCharacterSheetContext(
      input({
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
    expect(con.label).toBe("ADND2E.abilities.con");
    expect(con.mods.some((m) => m.label === "Hp Adjustment" && m.value === "1")).toBe(true);
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
            weapon: { damageVsSM: "1d8", damageVsL: "1d12", speedFactor: 5, range: null, category: "melee", damageType: "slashing" },
          }),
          physItem({
            id: "w2",
            name: "Dagger",
            type: "weapon",
            weapon: { damageVsSM: "1d4", damageVsL: null, speedFactor: 2, range: "10/20/30", category: "melee", damageType: "piercing" },
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
      },
    ]);
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

  it("weapon proficiencies pass straight; nwp check targets are computed", () => {
    const weapon: WeaponProfView = { id: "wp1", name: "Sword", weaponOrGroup: "long-sword", isGroup: false, slotsInvested: 1, masteryTier: 0, category: null, masteryTierLabelKey: null, canAdvanceMastery: false };
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

  it("seven tabs in order", () => {
    expect(buildCharacterSheetContext(input()).tabs.map((t) => t.id)).toEqual([
      "main",
      "combat",
      "inventory",
      "skills",
      "spells",
      "features",
      "biography",
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
    weapon: { damageVsSM: "1d8", damageVsL: "1d12", speedFactor: 5, range: null, category: "melee", damageType: "slashing" },
    ...over,
  });
  const weaponProf = (over: Partial<WeaponProfView> = {}): WeaponProfView => ({
    id: "wp1", name: "Long Sword Proficiency", weaponOrGroup: "Long Sword", isGroup: false,
    slotsInvested: 1, masteryTier: 0, category: null, masteryTierLabelKey: null, canAdvanceMastery: false,
    ...over,
  });
  const fighterClass = {
    id: "c1", name: "Fighter", img: "", chassisId: "fighter", hitDie: 10,
    xp: 0, level: 1, canLevelUp: false, dualClassState: null, specialistSchool: null,
  };
  // weaponMastery is gated behind combatAndTacticsEnabled + weaponMastery both being on;
  // this block's default fixture (`input()`) has both off, so every eligibility test here
  // opts them in explicitly.
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

  it("weaponMastery optional rule off → canAdvanceMastery false even when otherwise eligible", () => {
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
    expect(c.skills.weapon.items[0]!.canAdvanceMastery).toBe(false);
  });

  it("combatAndTacticsEnabled off (master switch) → canAdvanceMastery false even with weaponMastery on", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf()], nonweapon: [] },
        optionalRules: { ...DEFAULT_OPTIONAL_RULES, combatAndTacticsEnabled: false, weaponMastery: true },
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.canAdvanceMastery).toBe(false);
  });

  it("resolves category 'bow' for a bow-type weapon", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [
          weaponItem({
            id: "w2", name: "Long Bow",
            weapon: { damageVsSM: "1d6", damageVsL: "1d6", speedFactor: 7, range: "70/140/210", category: "bow", damageType: "piercing" },
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
            weapon: { damageVsSM: "1d4", damageVsL: "1d4", speedFactor: 8, range: "60/120/180", category: "crossbow", damageType: "piercing" },
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
          weapon: { damageVsSM: "1d4", damageVsL: "1d3", speedFactor: 2, range: null, category: "melee", damageType: "piercing" },
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
          weapon: { damageVsSM: "1d4", damageVsL: "1d3", speedFactor: 2, range: null, category: "melee", damageType: "piercing" },
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
          weapon: { damageVsSM: "1d6", damageVsL: "1d6", speedFactor: 7, range: null, category: "melee", damageType: "bludgeoning" },
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
          weapon: { damageVsSM: "1d4", damageVsL: "1d3", speedFactor: 2, range: null, category: "melee", damageType: "piercing" },
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
});

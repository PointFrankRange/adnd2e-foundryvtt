import { describe, expect, it } from "vitest";
import { buildCreatureSheetContext } from "../../../src/sheets/creature/context";
import type { CreatureGearView, CreatureSheetInput } from "../../../src/sheets/creature/context-types";

function input(over: Partial<CreatureSheetInput> = {}): CreatureSheetInput {
  return {
    name: "Owlbear",
    img: "icons/creature.webp",
    hd: { count: 5, dieType: 8, bonus: 2 },
    attributes: {
      hp: { value: 30, max: 30 },
      ac: { value: 5 },
      thac0: { value: 15 },
      movement: { land: 12, burrow: 0, climb: 0, fly: 0, swim: 0, flyManeuverability: "" },
    },
    attacks: [
      { name: "Claw", count: 2, damage: "1d6+1", thac0Override: null, type: "melee", special: "" },
      { name: "Bite", count: 1, damage: "1d8", thac0Override: null, type: "melee", special: "hug on both claws" },
    ],
    saves: {
      mode: "explicit",
      explicit: { ppd: 13, rsw: 14, pp: 15, bw: 16, spell: 17 },
      effective: { ppd: 13, rsw: 14, pp: 15, bw: 16, spell: 17 },
    },
    details: {
      size: "large", alignment: "true-neutral", intelligence: "animal", morale: 15,
      magicResistance: 0, treasureType: "C", numberAppearing: "1d4", xpValue: 175,
      specialAttacks: "", specialDefenses: "", description: "",
    },
    perms: { isGM: true, isOwner: true, editable: true },
    ...over,
  };
}

describe("buildCreatureSheetContext", () => {
  it("passes identity, HP, AC, THAC0 through", () => {
    const c = buildCreatureSheetContext(input());
    expect(c.identity.name).toBe("Owlbear");
    expect(c.identity.img).toBe("icons/creature.webp");
    expect(c.vitals.hp).toEqual({ value: 30, max: 30 });
    expect(c.vitals.ac).toBe(5);
    expect(c.vitals.thac0).toBe(15);
  });

  it("builds a movement summary omitting zero-value modes", () => {
    const c = buildCreatureSheetContext(input());
    expect(c.vitals.movementSummary).toBe("12");
  });

  it("includes every non-zero movement mode in the summary, land first", () => {
    const c = buildCreatureSheetContext(
      input({
        attributes: {
          ...input().attributes,
          movement: { land: 6, burrow: 0, climb: 3, fly: 18, swim: 0, flyManeuverability: "C" },
        },
      }),
    );
    expect(c.vitals.movementSummary).toBe("6, climb 3, fly 18 (C)");
  });

  it("omits the parenthetical when fly > 0 but flyManeuverability is blank (M7)", () => {
    const c = buildCreatureSheetContext(
      input({
        attributes: {
          ...input().attributes,
          movement: { land: 12, burrow: 0, climb: 0, fly: 18, swim: 0, flyManeuverability: "" },
        },
      }),
    );
    expect(c.vitals.movementSummary).toBe("12, fly 18");
  });

  it("maps each attacks[] entry to a row with the array index as id", () => {
    const c = buildCreatureSheetContext(input());
    expect(c.attacks).toHaveLength(2);
    expect(c.attacks[0]).toEqual({
      index: 0, name: "Claw", count: 2, damage: "1d6+1", type: "melee", special: "",
    });
    expect(c.attacks[1]!.name).toBe("Bite");
    expect(c.attacks[1]!.special).toBe("hug on both claws");
  });

  it("shows each save category's effective target", () => {
    const c = buildCreatureSheetContext(input());
    expect(c.saves).toEqual([
      { category: "ppd", label: "ADND2E.saves.ppd", target: 13 },
      { category: "rsw", label: "ADND2E.saves.rsw", target: 14 },
      { category: "pp", label: "ADND2E.saves.pp", target: 15 },
      { category: "bw", label: "ADND2E.saves.bw", target: 16 },
      { category: "spell", label: "ADND2E.saves.spell", target: 17 },
    ]);
  });

  it("passes details fields through, including nullable xpValue", () => {
    const c = buildCreatureSheetContext(input());
    expect(c.details.size).toBe("large");
    expect(c.details.alignment).toBe("true-neutral");
    expect(c.details.morale).toBe(15);
    expect(c.details.magicResistance).toBe(0);
    expect(c.details.xpValue).toBe(175);
  });

  it("passes a null xpValue through unchanged (not yet assigned)", () => {
    const c = buildCreatureSheetContext(input({ details: { ...input().details, xpValue: null } }));
    expect(c.details.xpValue).toBeNull();
  });

  it("passes perms through unchanged", () => {
    const c = buildCreatureSheetContext(input({ perms: { isGM: false, isOwner: true, editable: false } }));
    expect(c.perms).toEqual({ isGM: false, isOwner: true, editable: false });
  });
});

describe("buildCreatureSheetContext — gear, weapon attacks, spells", () => {
  const w = (over: Partial<CreatureGearView> = {}): CreatureGearView => ({
    id: "w1", name: "Long Sword", img: "", type: "weapon", quantity: 1, equipped: true,
    weapon: { category: "melee", magicBonus: 1, damageVsSM: "1d8", damageVsL: "1d12" },
    ...over,
  });

  it("is empty when the monster carries nothing", () => {
    const c = buildCreatureSheetContext(input());
    expect(c.gear).toEqual([]);
    expect(c.weaponAttacks).toEqual([]);
    expect(c.spells).toEqual([]);
  });

  it("lists all gear, but only EQUIPPED weapons become attack rows", () => {
    const c = buildCreatureSheetContext(
      input({
        gear: [
          w(),
          w({ id: "w2", name: "Short Bow", equipped: false, weapon: { category: "bow", magicBonus: 0, damageVsSM: null, damageVsL: null } }),
          w({ id: "w3", name: "Javelin", weapon: { category: "thrown", magicBonus: 0, damageVsSM: "1d6", damageVsL: "1d6" } }),
          { id: "a1", name: "Chain Mail", img: "", type: "armor", quantity: 1, equipped: true },
          { id: "e1", name: "Rope", img: "", type: "equipment", quantity: 2, equipped: false },
        ],
      }),
    );
    expect(c.gear.map((g) => [g.id, g.type, g.quantity, g.equipped])).toEqual([
      ["w1", "weapon", 1, true],
      ["w2", "weapon", 1, false],
      ["w3", "weapon", 1, true],
      ["a1", "armor", 1, true],
      ["e1", "equipment", 2, false],
    ]);
    expect(c.weaponAttacks).toEqual([
      { id: "w1", name: "Long Sword", damage: "1d8 / 1d12 +1", type: "melee" },
      { id: "w3", name: "Javelin", damage: "1d6 / 1d6", type: "ranged" },
    ]);
  });

  it("an equipped weapon item with no weapon data yields no attack row", () => {
    const c = buildCreatureSheetContext(input({ gear: [w({ weapon: undefined })] }));
    expect(c.weaponAttacks).toEqual([]);
  });

  it("groups spells by level, ascending", () => {
    const c = buildCreatureSheetContext(
      input({
        spells: [
          { id: "s3", name: "Fireball", img: "", level: 3 },
          { id: "s1", name: "Magic Missile", img: "", level: 1 },
          { id: "s1b", name: "Sleep", img: "", level: 1 },
        ],
      }),
    );
    expect(c.spells).toEqual([
      { level: 1, items: [{ id: "s1", name: "Magic Missile", img: "" }, { id: "s1b", name: "Sleep", img: "" }] },
      { level: 3, items: [{ id: "s3", name: "Fireball", img: "" }] },
    ]);
  });
});

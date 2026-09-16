import { describe, expect, it } from "vitest";
import { buildCreatureSheetContext } from "../../../src/sheets/creature/context";
import type { CreatureSheetInput } from "../../../src/sheets/creature/context-types";

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

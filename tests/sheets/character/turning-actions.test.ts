import { beforeEach, describe, expect, it } from "vitest";
import { turningPanel } from "../../../src/sheets/character/turning-actions";

beforeEach(() => {
  (globalThis as Record<string, unknown>).game = { user: { isGM: false } };
});

const kit = (overrides: unknown) => ({
  id: "k1", name: "Kit", type: "kit",
  system: {
    chassisId: "paladin",
    qualifications: { abilityMinimums: {}, races: [], alignments: [] },
    xpModifierPercent: 0, effects: [], equipment: { armor: { mode: "inherit", names: [] }, weapons: { mode: "inherit", names: [] } },
    forbiddenWeaponProficiencies: [], grantedFeatures: [], powers: [], overrides,
  },
});
const actor = (items: unknown[], level = 6) =>
  ({
    name: "Tam", img: "t.png", isOwner: true,
    system: { classes: [{ chassisId: "paladin", level }] },
    items,
    getFlag: () => undefined, setFlag: async () => undefined, unsetFlag: async () => undefined,
  }) as never;

describe("turningPanel with a kit turning rule (SP11 Plan C)", () => {
  const paladinClass = { id: "c1", name: "Paladin", type: "class", system: { chassisId: "paladin" } };
  it("a plain Paladin turns two levels lower", () => {
    expect(turningPanel(actor([paladinClass])).level).toBe(4);
  });
  it("a kit with turning offset 0 turns at full class level", () => {
    const ghost = kit({ casting: "none", turning: { mode: "offset", offset: 0 }, removedAbilities: [] });
    expect(turningPanel(actor([paladinClass, ghost])).level).toBe(6);
  });
  it("a kit with turning none cannot turn", () => {
    const none = kit({ casting: "inherit", turning: { mode: "none", offset: 0 }, removedAbilities: [] });
    expect(turningPanel(actor([paladinClass, none])).canTurn).toBe(false);
  });
});

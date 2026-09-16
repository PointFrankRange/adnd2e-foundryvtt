import { describe, expect, it } from "vitest";
import { buildAttackCardContext } from "../../src/combat/attack-card";
import type { AttackCardInput } from "../../src/combat/card-types";

function input(over: Partial<AttackCardInput> = {}): AttackCardInput {
  return {
    actorName: "Aldric", actorImg: "icons/svg/mystery-man.svg",
    weaponName: "Long Sword", targetName: "Goblin",
    formula: "1d20 + 3", naturalD20: 15,
    hit: { hit: true, autoHit: false, autoMiss: false, needed: 12, total: 18, margin: 6 },
    modifierBreakdown: { strength: 1, dexterityMissile: 0, weaponMagic: 0, proficiency: 0, range: 0, situational: 0 },
    damageContext: { weaponItemId: "w1", actorUuid: "Actor.a1", targetSize: "small", backstabMultiplier: null },
    backstab: false,
    ...over,
  };
}

describe("buildAttackCardContext", () => {
  it("passes through the roll and hit result", () => {
    const c = buildAttackCardContext(input());
    expect(c.actorName).toBe("Aldric");
    expect(c.weaponName).toBe("Long Sword");
    expect(c.targetName).toBe("Goblin");
    expect(c.formula).toBe("1d20 + 3");
    expect(c.naturalD20).toBe(15);
    expect(c.total).toBe(18);
    expect(c.needed).toBe(12);
    expect(c.margin).toBe(6);
    expect(c.hit).toBe(true);
    expect(c.autoHit).toBe(false);
    expect(c.autoMiss).toBe(false);
  });

  it("filters zero-value modifiers out of the displayed breakdown", () => {
    const c = buildAttackCardContext(input());
    expect(c.modifierBreakdown).toEqual([{ label: "ADND2E.chat.attack.modStrength", value: 1 }]);
  });

  it("keeps every non-zero modifier, including negative ones", () => {
    const c = buildAttackCardContext(input({
      modifierBreakdown: { strength: 0, dexterityMissile: -1, weaponMagic: 1, proficiency: -2, range: -5, situational: 3 },
    }));
    expect(c.modifierBreakdown).toEqual([
      { label: "ADND2E.chat.attack.modDexMissile", value: -1 },
      { label: "ADND2E.chat.attack.modWeaponMagic", value: 1 },
      { label: "ADND2E.chat.attack.modProficiency", value: -2 },
      { label: "ADND2E.chat.attack.modRange", value: -5 },
      { label: "ADND2E.chat.attack.modSituational", value: 3 },
    ]);
  });

  it("an all-zero breakdown yields an empty modifier list", () => {
    const c = buildAttackCardContext(input({
      modifierBreakdown: { strength: 0, dexterityMissile: 0, weaponMagic: 0, proficiency: 0, range: 0, situational: 0 },
    }));
    expect(c.modifierBreakdown).toEqual([]);
  });

  it("carries a null targetName and damageContext through unchanged", () => {
    const c = buildAttackCardContext(input({ targetName: null, damageContext: null }));
    expect(c.targetName).toBeNull();
    expect(c.damageContext).toBeNull();
  });

  it("carries autoHit/autoMiss through", () => {
    const c1 = buildAttackCardContext(input({ hit: { hit: true, autoHit: true, autoMiss: false, needed: 12, total: 23, margin: 11 } }));
    expect(c1.autoHit).toBe(true);
    const c2 = buildAttackCardContext(input({ hit: { hit: false, autoHit: false, autoMiss: true, needed: 12, total: 1, margin: -11 } }));
    expect(c2.autoMiss).toBe(true);
    expect(c2.hit).toBe(false);
  });

  it("carries backstab through unchanged", () => {
    const c1 = buildAttackCardContext(input({ backstab: true }));
    expect(c1.backstab).toBe(true);
    const c2 = buildAttackCardContext(input({ backstab: false }));
    expect(c2.backstab).toBe(false);
  });
});

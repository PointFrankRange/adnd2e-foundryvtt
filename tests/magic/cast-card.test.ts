import { describe, expect, it } from "vitest";
import { buildCastCardContext } from "../../src/magic/cast-card";
import type { CastCardInput } from "../../src/magic/card-types";

function input(over: Partial<CastCardInput> = {}): CastCardInput {
  return {
    actorName: "Aldric",
    actorImg: "icons/svg/mystery-man.svg",
    spellName: "Magic Missile",
    spellLevel: 1,
    range: "60 yd + 10 yd/level",
    duration: "instantaneous",
    castingTime: "1",
    savingThrow: "none",
    components: { v: true, s: true, m: false },
    rollResult: null,
    ...over,
  };
}

describe("buildCastCardContext", () => {
  it("no automation roll → rollResult and applyContext both null", () => {
    const c = buildCastCardContext(input());
    expect(c.rollResult).toBeNull();
    expect(c.applyContext).toBeNull();
  });

  it("damage roll → labeled rollResult + a damage applyContext", () => {
    const c = buildCastCardContext(
      input({ rollResult: { kind: "damage", formula: "2d4+2", total: 7 } }),
    );
    expect(c.rollResult).toEqual({ kind: "damage", label: "ADND2E.chat.cast.damageRoll", formula: "2d4+2", total: 7 });
    expect(c.applyContext).toEqual({ amount: 7, kind: "damage" });
  });

  it("healing roll → labeled rollResult + a healing applyContext", () => {
    const c = buildCastCardContext(
      input({ rollResult: { kind: "healing", formula: "1d8+1", total: 6 } }),
    );
    expect(c.rollResult).toEqual({ kind: "healing", label: "ADND2E.chat.cast.healingRoll", formula: "1d8+1", total: 6 });
    expect(c.applyContext).toEqual({ amount: 6, kind: "healing" });
  });

  it("savingThrow 'none' → hasSavingThrow false", () => {
    expect(buildCastCardContext(input({ savingThrow: "none" })).hasSavingThrow).toBe(false);
  });

  it("savingThrow other than 'none' → hasSavingThrow true", () => {
    expect(buildCastCardContext(input({ savingThrow: "negates" })).hasSavingThrow).toBe(true);
  });

  it("passes actor/spell display fields through unchanged", () => {
    const c = buildCastCardContext(input({ spellName: "Cure Light Wounds", spellLevel: 1 }));
    expect(c.spellName).toBe("Cure Light Wounds");
    expect(c.spellLevel).toBe(1);
    expect(c.components).toEqual({ v: true, s: true, m: false });
  });
});

import { describe, expect, it } from "vitest";
import { buildLearnSpellCardContext } from "../../src/magic/learn-spell-card";
import type { LearnSpellCardInput } from "../../src/magic/card-types";

function input(over: Partial<LearnSpellCardInput> = {}): LearnSpellCardInput {
  return {
    actorName: "Aldric",
    actorImg: "icons/svg/mystery-man.svg",
    spellName: "Magic Missile",
    spellLevel: 1,
    result: { allowed: true, chance: 55, reason: null },
    roll: { d100: 42, success: true },
    ...over,
  };
}

describe("buildLearnSpellCardContext", () => {
  it("allowed + successful roll passes through chance/roll and has no reasonLabel", () => {
    const c = buildLearnSpellCardContext(input());
    expect(c.allowed).toBe(true);
    expect(c.chance).toBe(55);
    expect(c.reasonLabel).toBeNull();
    expect(c.roll).toEqual({ d100: 42, success: true });
  });

  it("allowed + failed roll still has no reasonLabel", () => {
    const c = buildLearnSpellCardContext(
      input({ result: { allowed: true, chance: 20, reason: null }, roll: { d100: 87, success: false } }),
    );
    expect(c.allowed).toBe(true);
    expect(c.roll).toEqual({ d100: 87, success: false });
    expect(c.reasonLabel).toBeNull();
  });

  it("rejected: int-too-low", () => {
    const c = buildLearnSpellCardContext(
      input({ result: { allowed: false, chance: 0, reason: "int-too-low" }, roll: null }),
    );
    expect(c.allowed).toBe(false);
    expect(c.roll).toBeNull();
    expect(c.reasonLabel).toBe("ADND2E.chat.learnSpell.rejection.intTooLow");
  });

  it("rejected: spell-level-exceeds-int", () => {
    const c = buildLearnSpellCardContext(
      input({ result: { allowed: false, chance: 0, reason: "spell-level-exceeds-int" }, roll: null }),
    );
    expect(c.reasonLabel).toBe("ADND2E.chat.learnSpell.rejection.spellLevelExceedsInt");
  });

  it("rejected: opposition-school", () => {
    const c = buildLearnSpellCardContext(
      input({ result: { allowed: false, chance: 0, reason: "opposition-school" }, roll: null }),
    );
    expect(c.reasonLabel).toBe("ADND2E.chat.learnSpell.rejection.oppositionSchool");
  });

  it("rejected: per-level-cap-reached", () => {
    const c = buildLearnSpellCardContext(
      input({ result: { allowed: false, chance: 0, reason: "per-level-cap-reached" }, roll: null }),
    );
    expect(c.reasonLabel).toBe("ADND2E.chat.learnSpell.rejection.perLevelCapReached");
  });

  it("passes actor/spell display fields through unchanged", () => {
    const c = buildLearnSpellCardContext(input({ spellName: "Fireball", spellLevel: 3 }));
    expect(c.spellName).toBe("Fireball");
    expect(c.spellLevel).toBe(3);
    expect(c.actorName).toBe("Aldric");
  });
});

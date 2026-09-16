import { describe, expect, it } from "vitest";
import { buildThiefSkillCardContext } from "../../src/combat/thief-skill-card";

describe("buildThiefSkillCardContext", () => {
  const base = {
    actorName: "Sly", actorImg: "img.webp",
    skillLabel: "ADND2E.chat.thiefSkill.skills.pickPockets",
    formula: "1d100",
  };

  it("passes actor/formula/label fields through unchanged", () => {
    const c = buildThiefSkillCardContext({ ...base, roll: 40, result: { success: true, target: 55 } });
    expect(c.actorName).toBe("Sly");
    expect(c.actorImg).toBe("img.webp");
    expect(c.skillLabel).toBe(base.skillLabel);
    expect(c.formula).toBe("1d100");
  });

  it("flattens a successful result", () => {
    const c = buildThiefSkillCardContext({ ...base, roll: 40, result: { success: true, target: 55 } });
    expect(c.roll).toBe(40);
    expect(c.target).toBe(55);
    expect(c.success).toBe(true);
  });

  it("flattens a failed result", () => {
    const c = buildThiefSkillCardContext({ ...base, roll: 80, result: { success: false, target: 55 } });
    expect(c.roll).toBe(80);
    expect(c.target).toBe(55);
    expect(c.success).toBe(false);
  });

  it("a roll exactly equal to the target is a success (at-or-under rule)", () => {
    const c = buildThiefSkillCardContext({ ...base, roll: 55, result: { success: true, target: 55 } });
    expect(c.success).toBe(true);
  });
});

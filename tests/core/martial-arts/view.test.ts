import { describe, expect, it } from "vitest";
import { buildMartialArtsView, type StyleItemLike } from "../../../src/core/martial-arts";

const style = (id: string, form: string, principalMethod: string, slotsInvested = 1): StyleItemLike => ({
  id, name: id, img: "", type: "martialStyle", system: { form, principalMethod, slotsInvested },
});
const base = { enabled: true, knowsBasics: true, storedActiveId: "", canAct: true };

describe("buildMartialArtsView", () => {
  it("lists only martialStyle items with derived stats and activates the first by default", () => {
    const v = buildMartialArtsView({
      ...base,
      items: [{ id: "w", name: "Sword", img: "", type: "weapon", system: {} }, style("karate", "hard", "strike"), style("sumo", "hardSoft", "push", 2)],
    });
    expect(v.visible).toBe(true);
    expect(v.styles.map((s) => s.id)).toEqual(["karate", "sumo"]);
    expect(v.styles[0]).toMatchObject({
      formKey: "ADND2E.martialForms.hard", methodKey: "ADND2E.martialMethods.strike", attackFormKey: "ADND2E.martialAttackForms.hand",
      acMod: -1, damageDie: "1d4", slots: 1, active: true,
    });
    expect(v.styles[1]).toMatchObject({ acMod: -2, damageDie: "1d2", slots: 2, active: false });
    expect(v.active?.id).toBe("karate");
    expect(v.canAttack).toBe(true);
  });
  it("honors a stored active id and defaults a missing slot count to 1", () => {
    const s = style("sumo", "hardSoft", "push");
    delete (s.system as { slotsInvested?: number }).slotsInvested;
    const v = buildMartialArtsView({ ...base, storedActiveId: "sumo", items: [style("karate", "hard", "strike"), s] });
    expect(v.active?.id).toBe("sumo");
    expect(v.styles[1]!.slots).toBe(1);
  });
  it("cannot attack with no style or when unable to act; hidden when the rule is off", () => {
    expect(buildMartialArtsView({ ...base, items: [] })).toMatchObject({ visible: true, active: null, canAttack: false, styles: [] });
    expect(buildMartialArtsView({ ...base, canAct: false, items: [style("karate", "hard", "strike")] }).canAttack).toBe(false);
    expect(buildMartialArtsView({ ...base, enabled: false, items: [] }).visible).toBe(false);
  });
});

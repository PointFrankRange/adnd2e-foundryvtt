import { describe, expect, it } from "vitest";
import enJson from "../../lang/en.json";
import { MANEUVERS, MANEUVER_LISTS } from "../../src/core/martial-arts";

const LANG = (enJson as unknown as { ADND2E: Record<string, Record<string, string>> }).ADND2E;

describe("martial maneuver labels", () => {
  it("every registry slug has a name, an effect and a failure text", () => {
    for (const m of MANEUVERS) {
      expect(LANG.martialManeuvers?.[m.slug], `name ${m.slug}`).toBeTruthy();
      expect(LANG.martialManeuverEffects?.[m.slug], `effect ${m.slug}`).toBeTruthy();
      if (m.kind === "attack" || m.kind === "parry") expect(LANG.martialManeuverFailures?.[m.slug], `failure ${m.slug}`).toBeTruthy();
    }
  });
  it("every list and cost has a label, and none ends in an ellipsis", () => {
    for (const l of MANEUVER_LISTS) expect(LANG.martialManeuverLists?.[l], l).toBeTruthy();
    for (const c of ["none", "one", "two", "round"]) expect(LANG.martialManeuverCosts?.[c], c).toBeTruthy();
    for (const map of ["martialManeuvers", "martialManeuverEffects", "martialManeuverFailures", "martialManeuverLists", "martialManeuverCosts", "martialEffects"]) {
      for (const [k, v] of Object.entries(LANG[map]!)) expect(v.endsWith("…") || v.endsWith("..."), `${map}.${k}`).toBe(false);
    }
  });
  it("every effect id has a label and every list label exists", () => {
    const ids = new Set(MANEUVERS.flatMap((m) => (m.effects ?? []).map((e) => e.id)));
    expect(ids.size).toBeGreaterThanOrEqual(7);
    for (const id of ids) expect(LANG.martialEffects?.[id], `effect ${id}`).toBeTruthy();
    for (const l of MANEUVER_LISTS) expect(LANG.martialManeuverLists?.[l], l).toBeTruthy();
  });
  it("the B3 card, summary and breakdown keys exist", () => {
    const ma = (enJson as unknown as { ADND2E: { chat: { martialArts: Record<string, unknown> } } }).ADND2E.chat.martialArts;
    const mod = ma.mod as Record<string, unknown>;
    expect(mod.maneuver, "mod.maneuver").toBeTruthy();
    for (const key of [
      "landed", "fell", "leapStanding", "leapRunning", "speedYes", "speedNo", "speedExtra", "speedOnce",
      "levitationRate", "levitationDuration", "levitationRules",
    ]) expect(typeof ma[key] === "string" && ma[key], key).toBeTruthy();
    const sheet = (enJson as unknown as { ADND2E: { sheet: { martialArts: Record<string, unknown> } } }).ADND2E.sheet.martialArts;
    expect(sheet.constants).toBeTruthy();
  });
  it("the ineffective-hit and ch'i rank labels exist (SP18 Plan C)", () => {
    const A = (enJson as unknown as { ADND2E: { chat: { martialArts: Record<string, string> }; martialChi: Record<string, string> } }).ADND2E;
    expect(A.chat.martialArts.noEffect).toBeTruthy();
    for (let n = 0; n <= 5; n++) expect(A.martialChi[`rank${n}`], `rank${n}`).toBeTruthy();
  });
});

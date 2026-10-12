import { describe, expect, it } from "vitest";
import enJson from "../../lang/en.json";
import { MANEUVERS, MANEUVER_LISTS } from "../../src/core/martial-arts";

const LANG = (enJson as unknown as { ADND2E: Record<string, Record<string, string>> }).ADND2E;

describe("martial maneuver labels", () => {
  it("every registry slug has a name, an effect and a failure text", () => {
    for (const m of MANEUVERS) {
      expect(LANG.martialManeuvers?.[m.slug], `name ${m.slug}`).toBeTruthy();
      expect(LANG.martialManeuverEffects?.[m.slug], `effect ${m.slug}`).toBeTruthy();
      expect(LANG.martialManeuverFailures?.[m.slug], `failure ${m.slug}`).toBeTruthy();
    }
  });
  it("every list and cost has a label, and none ends in an ellipsis", () => {
    for (const l of MANEUVER_LISTS) expect(LANG.martialManeuverLists?.[l], l).toBeTruthy();
    for (const c of ["none", "one", "two", "round"]) expect(LANG.martialManeuverCosts?.[c], c).toBeTruthy();
    for (const map of ["martialManeuvers", "martialManeuverEffects", "martialManeuverFailures", "martialManeuverLists", "martialManeuverCosts"]) {
      for (const [k, v] of Object.entries(LANG[map]!)) expect(v.endsWith("…") || v.endsWith("..."), `${map}.${k}`).toBe(false);
    }
  });
});

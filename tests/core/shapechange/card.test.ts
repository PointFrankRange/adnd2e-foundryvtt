import { describe, expect, it } from "vitest";
import { buildShapechangeCardContext } from "../../../src/core/shapechange";

const input = { actorName: "Rowan", actorImg: "r.png", formName: "Brown Bear", d6: 3, healed: 4, usesLeft: 2, usesMax: 3, returning: false };

describe("buildShapechangeCardContext", () => {
  it("passes the fields through and names the shift headline", () => {
    expect(buildShapechangeCardContext(input)).toEqual({ ...input, headlineKey: "ADND2E.chat.shapechange.shift" });
  });
  it("names the return headline when returning to normal form", () => {
    expect(buildShapechangeCardContext({ ...input, returning: true }).headlineKey).toBe("ADND2E.chat.shapechange.return");
  });
});

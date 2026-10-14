import { describe, expect, it } from "vitest";
import { prototypeTokenLinkDefault } from "../../src/core/tokens";

describe("prototypeTokenLinkDefault", () => {
  it("links a character with no explicit value", () => {
    expect(prototypeTokenLinkDefault("character", undefined)).toBe(true);
  });
  it("respects an explicit true or false on a character", () => {
    expect(prototypeTokenLinkDefault("character", true)).toBeNull();
    expect(prototypeTokenLinkDefault("character", false)).toBeNull();
  });
  it("leaves npc and creature actors alone", () => {
    expect(prototypeTokenLinkDefault("npc", undefined)).toBeNull();
    expect(prototypeTokenLinkDefault("creature", undefined)).toBeNull();
  });
});

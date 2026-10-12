import { describe, expect, it } from "vitest";
import { parseRaceSlugLines } from "../../../src/core/races/slug-lines";

describe("parseRaceSlugLines", () => {
  it("returns trimmed slugs and drops blank lines (CRLF too)", () => {
    expect(parseRaceSlugLines(" lizard-man \r\n\r\nhuman\n")).toEqual(["lizard-man", "human"]);
  });
  it("returns an empty list for empty text", () => {
    expect(parseRaceSlugLines("")).toEqual([]);
  });
  it("fails the whole parse when any line is not a slug", () => {
    expect(parseRaceSlugLines("human\nLizard Man")).toBeNull();
    expect(parseRaceSlugLines("Human")).toBeNull();
  });
});

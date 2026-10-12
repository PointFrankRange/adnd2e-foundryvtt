import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { STYLE_FORMS, STYLE_METHODS } from "../../src/core/martial-arts";
import { MARTIAL_STYLE_FORMS, MARTIAL_STYLE_METHODS } from "../../src/data/item/choices";

const read = (...p: string[]) => readFileSync(path.resolve(__dirname, "..", "..", ...p), "utf8");
const SRC = read("src", "data", "item", "martial-style.ts");
const INDEX = read("src", "data", "item", "index.ts");
const ACTOR = read("src", "data", "actor", "base-actor.ts");
const line = (src: string, field: string) => src.split("\n").find((l) => new RegExp("^\\s*" + field + ":\\s*new ").test(l)) ?? "";

describe("MartialStyleItemModel schema (source-pinned)", () => {
  it("is registered", () => {
    expect(INDEX).toContain("martialStyle: MartialStyleItemModel");
  });
  it("defaults to a hard strike style with one slot", () => {
    expect(line(SRC, "form")).toContain('initial: "hard"');
    expect(line(SRC, "form")).toContain("choices: MARTIAL_STYLE_FORMS");
    expect(line(SRC, "principalMethod")).toContain('initial: "strike"');
    expect(line(SRC, "principalMethod")).toContain("choices: MARTIAL_STYLE_METHODS");
    expect(line(SRC, "slotsInvested")).toMatch(/integer: true, min: 1, initial: 1/);
  });
  it("uses function initials for its arrays (shared-literal gotcha)", () => {
    expect(SRC).not.toMatch(/initial: [[{]/);
    expect(SRC.match(/initial: \(\) => \[\]/g)!.length).toBeGreaterThanOrEqual(2);
  });
});

describe("martial arts vocabularies and actor field", () => {
  it("re-exports the pure vocabularies", () => {
    expect([...MARTIAL_STYLE_FORMS]).toEqual([...STYLE_FORMS]);
    expect([...MARTIAL_STYLE_METHODS]).toEqual([...STYLE_METHODS]);
  });
  it("the actor common schema carries martialArts with defaults only", () => {
    expect(ACTOR).toMatch(/martialArts: new SchemaField\(/);
    expect(ACTOR).toMatch(/knowsBasics: new BooleanField\(\{ required: true, initial: false \}\)/);
    expect(ACTOR).toMatch(/activeStyleId: new StringField\(\{ required: true, blank: true, initial: "" \}\)/);
  });
});

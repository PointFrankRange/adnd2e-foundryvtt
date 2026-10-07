import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Foundry's DataField#getInitialValue returns an object-literal `initial`
// WITHOUT cloning, so every model whose source lacks the field shares ONE
// object, and ObjectField._updateDiff (merge-style actor.update) mutates it in
// place: one actor's data would leak onto all others. Fields that are written
// by merge-style updates must therefore use a function initial.
const SRC = readFileSync(path.resolve(__dirname, "..", "..", "src", "data", "actor", "base-actor.ts"), "utf8");

describe("ObjectField initial must not be a shared literal", () => {
  const line = SRC.split("\n").find((l) => /^\s*kitPowers:\s*new ObjectField/.test(l)) ?? "";
  it("kitPowers is declared", () => {
    expect(line).not.toBe("");
  });
  it("kitPowers does not use an object-literal initial", () => {
    expect(line).not.toContain("initial: {}");
  });
  it("kitPowers uses a function initial", () => {
    expect(line).toContain("initial: () =>");
  });
});

describe("SP15 Plan C psionics.activeDefense / contacts initials", () => {
  it("contacts uses a function initial and activeDefense a blank string", () => {
    const at = SRC.indexOf("contacts: new ArrayField");
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, at + 500);
    expect(body).toMatch(/initial:\s*\(\)\s*=>\s*\[\]/);
    expect(body).not.toMatch(/initial:\s*\[/);
    expect(SRC).toContain('activeDefense: new StringField({ required: true, blank: true, initial: "" })');
  });
});

describe("SP15 Plan D wildTalent schema", () => {
  it("declares tested/found false and levelAtDiscovery 0, and a cached psionics.wild false (no object/array literal initial)", () => {
    const at = SRC.indexOf("wildTalent: new SchemaField");
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, at + 500);
    expect(body).toContain("tested: new BooleanField({ required: true, initial: false })");
    expect(body).toContain("found: new BooleanField({ required: true, initial: false })");
    expect(body).toContain("levelAtDiscovery: new NumberField({ required: true, integer: true, min: 0, initial: 0 })");
    expect(SRC).toContain("wild: new BooleanField({ required: true, initial: false })");
  });
});

describe("SP15 psionics.maintained initial", () => {
  it("is declared with a function initial, not a shared array literal", () => {
    const at = SRC.indexOf("maintained: new ArrayField");
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, at + 400);
    expect(body).toMatch(/initial:\s*\(\)\s*=>\s*\[\]/);
    expect(body).not.toMatch(/initial:\s*\[/);
  });
});

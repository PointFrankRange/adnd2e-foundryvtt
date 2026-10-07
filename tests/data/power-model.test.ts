import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DISCIPLINES } from "../../src/core/psionics";
import { POWER_DISCIPLINES, POWER_KINDS, POWER_MAINTENANCE_UNITS } from "../../src/data/item/choices";

// The model needs Foundry's runtime (foundry.data.fields), which this node-only suite does not load,
// so the schema is pinned by its source text plus the exported vocabularies it draws from.
const SRC = readFileSync(path.resolve(__dirname, "..", "..", "src", "data", "item", "power.ts"), "utf8");
const INDEX = readFileSync(path.resolve(__dirname, "..", "..", "src", "data", "item", "index.ts"), "utf8");
const line = (field: string) => SRC.split("\n").find((l) => new RegExp("^\\s*" + field + ":\\s*new ").test(l)) ?? "";

describe("PowerItemModel schema (source-pinned)", () => {
  it("is registered as the power item model", () => {
    expect(INDEX).toContain("power: PowerItemModel");
  });
  it("defaults a blank power to clairsentience / devotion / wis, zero costs, no maintenance", () => {
    expect(line("discipline")).toContain('initial: "clairsentience"');
    expect(line("kind")).toContain('initial: "devotion"');
    expect(line("abilityKey")).toContain('initial: "wis"');
    for (const f of ["abilityModifier", "initialCost", "maintenanceCost", "scoreBonus"]) expect(line(f), f).toContain("initial: 0");
    expect(line("maintenanceUnit")).toContain('initial: "none"');
  });
  it("models prerequisites as a factory-initial string array and minLevel as a non-negative integer", () => {
    expect(line("prerequisites")).toContain("new ArrayField(new StringField({ required: true, blank: false })");
    expect(line("prerequisites")).toContain("initial: () => []");
    expect(line("minLevel")).toMatch(/integer: true, min: 0, initial: 0/);
  });
  it("constrains the choice fields to the exported vocabularies", () => {
    expect(line("discipline")).toContain("choices: POWER_DISCIPLINES");
    expect(line("kind")).toContain("choices: POWER_KINDS");
    expect(line("maintenanceUnit")).toContain("choices: POWER_MAINTENANCE_UNITS");
    expect(line("abilityKey")).toContain("choices: ABILITY_KEYS");
  });
  it("models wildMinimum as a nullable non-negative integer defaulting to null", () => {
    expect(line("wildMinimum")).toContain("required: true, nullable: true, integer: true, min: 0, initial: null");
  });
  it("keeps costs integer and non-negative, with no literal-object initials", () => {
    for (const f of ["initialCost", "maintenanceCost", "scoreBonus"]) expect(line(f), f).toMatch(/integer: true, min: 0/);
    expect(SRC).not.toMatch(/initial: [[{]/);
  });
});

describe("power vocabularies", () => {
  it("disciplines come from the pure psionics tables", () => {
    expect(POWER_DISCIPLINES).toBe(DISCIPLINES);
  });
  it("kinds and maintenance units", () => {
    expect([...POWER_KINDS]).toEqual(["science", "devotion", "defense"]);
    expect([...POWER_MAINTENANCE_UNITS]).toEqual(["none", "round", "turn", "hour"]);
  });
});

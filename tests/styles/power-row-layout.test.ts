import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PC = readFileSync(path.resolve(__dirname, "..", "..", "styles", "actor", "pc.scss"), "utf8");

describe("power-row layout (SP18 B2)", () => {
  it("is a wrapping flex row so the Learn/Use button sits inline after the spans", () => {
    expect(PC).toMatch(/\.adnd2e\.pc-sheet \.power-row\s*\{[^}]*display:\s*flex[^}]*\}/);
    expect(PC).toMatch(/\.adnd2e\.pc-sheet \.power-row\s*\{[^}]*flex-wrap:\s*wrap[^}]*\}/);
    expect(PC).toMatch(/\.adnd2e\.pc-sheet \.power-row\s*\{[^}]*align-items:\s*center[^}]*\}/);
  });
  it("no longer relies on a left margin between adjacent spans", () => {
    expect(PC).not.toMatch(/\.power-row > span \+ span\s*\{\s*margin-left:\s*8px/);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PC = readFileSync(path.resolve(__dirname, "..", "..", "styles", "actor", "pc.scss"), "utf8");
const HEADER = readFileSync(path.resolve(__dirname, "..", "..", "templates", "actor", "pc", "header.hbs"), "utf8");

describe("HP box layout (#164)", () => {
  it("the HP value span carries kit-hp alongside kit-big", () => {
    expect(HEADER).toMatch(/class="kit-big kit-hp"><input type="number" name="system\.attributes\.hp\.value"/);
  });
  it("keeps value and max on one line and sizes the input to its content", () => {
    expect(PC).toMatch(/&\.kit-hp\s*\{[^}]*flex-wrap:\s*nowrap[^}]*\}/);
    expect(PC).toMatch(/&\.kit-hp\s*\{[^}]*white-space:\s*nowrap[^}]*\}/);
    expect(PC).toMatch(/&\.kit-hp\s*\{[^}]*field-sizing:\s*content[^}]*\}/);
    expect(PC).toMatch(/&\.kit-hp\s*\{[^}]*max-width:\s*7ch[^}]*\}/);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const TOKENS = readFileSync(path.join(ROOT, "styles", "theme", "_tokens.scss"), "utf8");
const KIT = readFileSync(path.join(ROOT, "styles", "kit", "_kit.scss"), "utf8");

describe("sheet theme scope (#150)", () => {
  it("theme tokens apply to every raw-field sheet (item, active effect, raw actor), not just items", () => {
    expect(TOKENS).toContain(".adnd2e.raw-field-sheet");
    expect(TOKENS).not.toContain(".raw-field-sheet.item");
  });
  it("kit rules apply to every raw-field sheet", () => {
    expect(KIT).toContain(".adnd2e.raw-field-sheet");
    expect(KIT).not.toContain(".raw-field-sheet.item");
  });
  it("keeps the dark-mode token switch for both the body class and the app class", () => {
    expect(TOKENS).toContain("body.theme-dark .adnd2e.raw-field-sheet");
    expect(TOKENS).toContain(".adnd2e.raw-field-sheet.theme-dark");
  });
  it("the name field stretches outside the item sheet (flex rule is not item-scoped)", () => {
    expect(KIT).toMatch(/input\.raw-name\s*\{[^}]*flex:\s*1/);
    expect(KIT).not.toMatch(/\.raw-field-sheet\.item[^{]*\{[^}]*input\.raw-name/);
  });
});

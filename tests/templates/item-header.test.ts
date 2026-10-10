import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const TEMPLATE = readFileSync(path.resolve(__dirname, "..", "..", "templates", "sheets", "raw-fields.hbs"), "utf8");

describe("item sheet header image (#148)", () => {
  it("renders the image through the core editImage action", () => {
    expect(TEMPLATE).toContain('data-action="editImage"');
    expect(TEMPLATE).toContain('data-edit="img"');
    expect(TEMPLATE).toContain("raw-portrait");
  });
  it("shows a placeholder portrait for a blank image that is never saved unpicked", () => {
    expect(TEMPLATE).toContain("hasPortrait");
    expect(TEMPLATE).toContain("data-placeholder");
  });
  it("no longer renders the raw image path as a form input", () => {
    expect(TEMPLATE).toContain('(eq this.path "img")');
  });
  it("includes the Effects partial for gear sheets", () => {
    expect(TEMPLATE).toContain("adnd2e.raw-effects");
    expect(TEMPLATE).toContain("itemEffects");
  });
});

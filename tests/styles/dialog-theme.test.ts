import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const TOKENS = readFileSync(path.join(ROOT, "styles", "theme", "_tokens.scss"), "utf8");
const DIALOG = readFileSync(path.join(ROOT, "styles", "dialog", "_dialog.scss"), "utf8");
const SYSTEM = readFileSync(path.join(ROOT, "styles", "system.scss"), "utf8");

describe("dialog theme (#150)", () => {
  it("is loaded from system.scss", () => {
    expect(SYSTEM).toContain("dialog/dialog");
  });
  it("the shared token blocks cover the dialog in both themes, keyed to the app element", () => {
    expect(TOKENS).toContain(".adnd2e.adnd2e-dialog");
    expect(TOKENS).toContain("body.theme-dark .adnd2e.adnd2e-dialog");
    expect(TOKENS).toContain(".adnd2e.adnd2e-dialog.theme-dark");
  });
  it("styles the title bar, form fields and footer buttons", () => {
    expect(DIALOG).toContain(".window-header");
    expect(DIALOG).toContain(".form-footer");
    expect(DIALOG).toContain('[data-action="ok"]');
    expect(DIALOG).toContain('[data-action="yes"]');
    expect(DIALOG).toContain(":disabled");
  });
  it("only ever targets our own dialog class, never every core dialog", () => {
    expect(DIALOG).toContain(".adnd2e.adnd2e-dialog");
    expect(DIALOG).not.toMatch(/(^|\n)\s*\.dialog\b/);
  });
  it("uses no !important and never core's bare .disabled class", () => {
    expect(DIALOG).not.toContain("!important");
    expect(DIALOG).not.toMatch(/\.disabled\b/);
  });
});

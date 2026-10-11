import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..", "src");
const WRAPPER = path.join(SRC, "dialogs", "themed-dialog-foundry.ts");

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === "types" ? [] : tsFiles(p);
    return p.endsWith(".ts") && !p.endsWith(".d.ts") ? [p] : [];
  });
}

/** Source with block and line comments removed, so prose mentioning a pattern is not a call. */
function code(file: string): string {
  return readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("dialog theming guard (#150)", () => {
  it("no file other than the wrapper references DialogV2", () => {
    const offenders = tsFiles(SRC)
      .filter((f) => f !== WRAPPER)
      .filter((f) => /\bDialogV2\b/.test(code(f)))
      .map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it("the wrapper themes every dialog it opens", () => {
    const wrapper = code(WRAPPER);
    expect(wrapper).toContain("withDialogTheme");
    expect(wrapper).toMatch(/DialogV2\s*\.\s*prompt\s*\(/);
    expect(wrapper).toMatch(/DialogV2\s*\.\s*confirm\s*\(/);
  });

  it("every known dialog call-site file imports the wrappers", () => {
    const importers = tsFiles(SRC)
      .filter((f) => f !== WRAPPER)
      .filter((f) => /themedPrompt|themedConfirm/.test(code(f)))
      .map((f) => path.relative(SRC, f).replace(/\\/g, "/"))
      .sort();
    expect(importers).toEqual(
      expect.arrayContaining([
        "combat/initiative-modifier-dialog.ts",
        "relay/relay-handler.ts",
        "sheets/character/combat-rolls.ts",
        "sheets/character/free-magick-dialog.ts",
        "sheets/character/psionic-wild.ts",
        "sheets/character/recover-dialog.ts",
        "sheets/character/sheet.ts",
        "sheets/creature/combat-rolls.ts",
        "sheets/effects-actions.ts",
        "sheets/item-effects-actions.ts",
        "sheets/item-row-actions.ts",
      ]),
    );
  });
});

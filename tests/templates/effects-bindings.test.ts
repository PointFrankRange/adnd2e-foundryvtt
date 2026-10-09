import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");

const TEMPLATE = read("templates", "actor", "shared", "effects.hbs");
const SHEETS = [
  { name: "Adnd2eCharacterSheet", src: read("src", "sheets", "character", "sheet.ts") },
  { name: "Adnd2eNpcSheet", src: read("src", "sheets", "npc", "sheet.ts") },
  { name: "Adnd2eCreatureSheet", src: read("src", "sheets", "creature", "sheet.ts") },
];

describe("Effects tab bindings (#128)", () => {
  const used = [...new Set([...TEMPLATE.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!))];

  it("the shared template uses exactly the six effect actions", () => {
    expect(used.sort()).toEqual(
      ["createEffect", "deleteEffect", "editEffect", "openEffectSource", "removeCondition", "toggleEffect"],
    );
  });

  for (const sheet of SHEETS) {
    it(`${sheet.name} registers every action the template uses`, () => {
      for (const action of used) {
        expect(sheet.src, action).toMatch(new RegExp(`^\\s+${action}: ${sheet.name}\\.#on`, "m"));
      }
    });
    it(`${sheet.name} declares the effects part, the effects tab and the effectsView context`, () => {
      expect(sheet.src).toContain("actor/shared");
      expect(sheet.src).toMatch(/effects: \{ template: .*effects\.hbs/);
      expect(sheet.src).toMatch(/\{ id: "effects"/);
      expect(sheet.src).toContain("effectsView");
    });
  }
});

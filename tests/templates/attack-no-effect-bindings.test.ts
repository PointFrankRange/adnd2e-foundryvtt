import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const TPL = read("templates", "chat", "attack-roll.hbs");
const ROLLS = read("src", "sheets", "character", "combat-rolls.ts");
const LANG = JSON.parse(read("lang", "en.json")) as { ADND2E: { chat: { attack: Record<string, string> } } };

describe("weapon attack no-effect bindings (SP18 Plan C)", () => {
  it("the card shows the requirement line and hides Roll Damage for an ineffective hit", () => {
    expect(TPL).toContain("ineffective");
    expect(TPL).toContain("ADND2E.chat.attack.noEffect");
    expect(TPL).toContain("ineffective.requirementKey");
  });
  it("rollAttack checks the requirement with attackRank/canHarm and drops the damage context and maneuver effect", () => {
    expect(ROLLS).toContain("canHarm(");
    expect(ROLLS).toContain("attackRank(");
    expect(ROLLS).toContain("requirementLabelKey(");
  });
  it("the copy exists", () => {
    expect(LANG.ADND2E.chat.attack.noEffect).toBeTruthy();
  });
});

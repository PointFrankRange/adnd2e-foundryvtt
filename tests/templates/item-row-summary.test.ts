import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const TABLE = readFileSync(path.resolve(__dirname, "..", "..", "templates", "actor", "pc", "partials", "pc-item-table.hbs"), "utf8");

describe("inventory row summary (#111)", () => {
  it("labels category, damage type and armor type through adnd2eLabel instead of printing raw values", () => {
    expect(TABLE).toContain("adnd2eLabel 'weaponCategories' r.item.weapon.category");
    expect(TABLE).toContain("adnd2eLabel 'weaponDamageTypes' r.item.weapon.damageType");
    expect(TABLE).toContain("adnd2eLabel 'armorTypes' r.item.armor.armorType");
    expect(TABLE).not.toContain("{{r.item.weapon.category}}");
    expect(TABLE).not.toContain("{{r.item.weapon.damageType}}");
    expect(TABLE).not.toContain("{{r.item.armor.armorType}}");
  });
  it("shows the enriched description under the stats", () => {
    expect(TABLE).toContain("{{{r.item.descriptionHtml}}}");
    expect(TABLE).toContain('class="kit-description"');
  });
});

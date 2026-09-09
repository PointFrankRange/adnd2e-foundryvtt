import { describe, expect, it } from "vitest";
import { resolveDualClass, resolveMulticlass, type ClassMember } from "../../../src/core/classes/multiclass";

const fighter = (level: number): ClassMember => ({ chassisId: "fighter", level, specialistSchool: null });
const mage = (level: number): ClassMember => ({ chassisId: "mage", level, specialistSchool: null });
const cleric = (level: number): ClassMember => ({ chassisId: "cleric", level, specialistSchool: null });

describe("resolveMulticlass", () => {
  it("elf Fighter 5 / Mage 6: best THAC0 is the fighter table, saves list both", () => {
    const r = resolveMulticlass([fighter(5), mage(6)], { perClassHp: [49, 26], averageHp: true });
    // thac0("warrior",5)=16  vs  thac0("wizard",6)=19  -> fighter wins
    expect(r.bestThac0).toEqual({ group: "warrior", level: 5 });
    expect(r.saveGroups).toEqual([
      { group: "warrior", level: 5 },
      { group: "wizard", level: 6 },
    ]);
    // weapon: fighter 4+floor(5/3)=5  vs  mage 1+floor(6/6)=2  -> fighter
    expect(r.weaponProfSource).toEqual({ chassisId: "fighter", level: 5 });
    // nonweapon: fighter 3+floor(5/3)=4  vs  mage 4+floor(6/3)=6  -> mage
    expect(r.nonweaponProfSource).toEqual({ chassisId: "mage", level: 6 });
    expect(r.casters.map((c) => c.chassisId)).toEqual(["mage"]);
    expect(r.hpMax).toBe(37); // floor((49+26)/2)
  });

  it("averageHp false -> the single highest class HP total", () => {
    const r = resolveMulticlass([fighter(5), mage(6)], { perClassHp: [49, 26], averageHp: false });
    expect(r.hpMax).toBe(49);
  });

  it("Fighter/Mage/Cleric: two casters, first-wins tie-break on nonweapon", () => {
    const r = resolveMulticlass([fighter(4), mage(4), cleric(4)], { perClassHp: [38, 17, 33], averageHp: true });
    expect(r.bestThac0).toEqual({ group: "warrior", level: 4 }); // 17 < 19 (wiz) , 18 (priest)
    expect(r.casters.map((c) => c.chassisId)).toEqual(["mage", "cleric"]);
    expect(r.hpMax).toBe(29); // floor(88/3)
    // nonweapon: fighter 4, mage 5, cleric 5 -> mage (earlier of the tie)
    expect(r.nonweaponProfSource.chassisId).toBe("mage");
    // weapon: fighter 5, mage 1, cleric 3 -> fighter
    expect(r.weaponProfSource.chassisId).toBe("fighter");
  });

  it("best THAC0 / prof can be a later member (loop covers the 'not index 0' branch)", () => {
    const r = resolveMulticlass([mage(6), fighter(5)], { perClassHp: [26, 49], averageHp: true });
    expect(r.bestThac0).toEqual({ group: "warrior", level: 5 });
    expect(r.weaponProfSource.chassisId).toBe("fighter");
  });
});

describe("resolveDualClass", () => {
  it("suppressed (active <= primary): active class only, HP frozen", () => {
    const r = resolveDualClass({
      primary: fighter(6),
      active: mage(3),
      primaryFrozenHp: 64,
      activeHpAbovePrimary: 0,
    });
    expect(r.surpassed).toBe(false);
    expect(r.dormantChassisId).toBe("fighter");
    expect(r.activeChassisId).toBe("mage");
    expect(r.bestThac0).toEqual({ group: "wizard", level: 3 });
    expect(r.saveGroups).toEqual([{ group: "wizard", level: 3 }]);
    // proficiencies are retained in dual-classing (PHB p.45) — best-of-both even while suppressed
    expect(r.weaponProfSource).toEqual({ chassisId: "fighter", level: 6 });
    expect(r.nonweaponProfSource).toEqual({ chassisId: "fighter", level: 6 });
    expect(r.casters.map((c) => c.chassisId)).toEqual(["mage"]);
    expect(r.hpMax).toBe(64);
  });

  it("surpassed (active > primary): best-of both, HP = frozen + active above primary", () => {
    const r = resolveDualClass({
      primary: fighter(6),
      active: mage(7),
      primaryFrozenHp: 64,
      activeHpAbovePrimary: 5,
    });
    expect(r.surpassed).toBe(true);
    // thac0("warrior",6)=15  vs  thac0("wizard",7)=18  -> fighter
    expect(r.bestThac0).toEqual({ group: "warrior", level: 6 });
    expect(r.saveGroups).toEqual([
      { group: "warrior", level: 6 },
      { group: "wizard", level: 7 },
    ]);
    // weapon: fighter 6 vs mage 2 -> fighter ; nonweapon: fighter 5 vs mage 6 -> mage
    expect(r.weaponProfSource).toEqual({ chassisId: "fighter", level: 6 });
    expect(r.nonweaponProfSource).toEqual({ chassisId: "mage", level: 7 });
    expect(r.casters.map((c) => c.chassisId)).toEqual(["mage"]);
    expect(r.hpMax).toBe(69);
  });

  it("surpassed, non-caster active + caster primary: primary re-enters the caster set", () => {
    const r = resolveDualClass({
      primary: mage(4),
      active: fighter(5),
      primaryFrozenHp: 20,
      activeHpAbovePrimary: 12,
    });
    expect(r.surpassed).toBe(true);
    expect(r.casters.map((c) => c.chassisId)).toEqual(["mage"]);
  });
});

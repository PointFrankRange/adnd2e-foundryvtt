import { describe, expect, it } from "vitest";
import { MANEUVERS, MANEUVER_WEAPONS, WEAPON_GROUP_IDS, WEAPON_HIT_BONUS, assessWeaponUse } from "../../../src/core/martial-arts";

describe("MANEUVER_WEAPONS census", () => {
  it("covers every registry maneuver, and only with known group ids", () => {
    for (const m of MANEUVERS) expect(MANEUVER_WEAPONS[m.id], m.id).toBeDefined();
    for (const [id, use] of Object.entries(MANEUVER_WEAPONS)) {
      if (Array.isArray(use)) for (const g of use) expect(WEAPON_GROUP_IDS, `${id} ${g}`).toContain(g);
    }
    for (const id of Object.keys(WEAPON_HIT_BONUS)) expect(MANEUVER_WEAPONS[id], id).toBeDefined();
  });
  it("matches the book on the spot checks", () => {
    expect(MANEUVER_WEAPONS["kick:1"]).toBe("none");
    expect(MANEUVER_WEAPONS["block:1"]).toBe("any");
    expect(MANEUVER_WEAPONS["strike:1"]).toBe("any");
    expect(MANEUVER_WEAPONS["lock:4"]).toEqual(["chainWeapons", "ropeWeapons", "lashWeapons"]);
    expect(MANEUVER_WEAPONS["vitalArea:2"]).toEqual(["clubbingWeapons"]);
  });
});

describe("assessWeaponUse", () => {
  const sai = { name: "Sai +1", baseName: "" };
  it("is unarmed with no weapon (and Weapon Breaker then needs a style weapon)", () => {
    expect(assessWeaponUse({ maneuverId: "kick:1", knownGroups: [], weapons: [] })).toEqual({ state: "unarmed", weaponName: null, covered: false, hitBonus: 0 });
    expect(assessWeaponUse({ maneuverId: "weapon:1", knownGroups: [], weapons: [] }).state).toBe("needsStyleWeapon");
  });
  it("an unarmed-only maneuver while wielding is notAllowed", () => {
    expect(assessWeaponUse({ maneuverId: "kick:1", knownGroups: ["karateWeapons"], weapons: [sai] })).toMatchObject({ state: "notAllowed", weaponName: "Sai +1" });
  });
  it("'any' is ok; the sai bonus needs the group learned", () => {
    expect(assessWeaponUse({ maneuverId: "block:1", knownGroups: [], weapons: [sai] })).toEqual({ state: "uncovered", weaponName: "Sai +1", covered: false, hitBonus: 0 });
    expect(assessWeaponUse({ maneuverId: "block:1", knownGroups: ["karateWeapons"], weapons: [sai] })).toMatchObject({ state: "ok", covered: true, hitBonus: 2 });
    expect(assessWeaponUse({ maneuverId: "lock:2", knownGroups: ["karateWeapons"], weapons: [sai] }).hitBonus).toBe(2);
  });
  it("chain and rope groups give Grappling Block +2", () => {
    const chain = { name: "Kusarigama", baseName: "" };
    expect(assessWeaponUse({ maneuverId: "block:3", knownGroups: ["chainWeapons"], weapons: [chain] })).toMatchObject({ state: "ok", hitBonus: 2 });
  });
  it("a listed group must be learned: uncovered when not, notAllowed when the weapon is in no permitted group", () => {
    const club = { name: "Club", baseName: "" };
    expect(assessWeaponUse({ maneuverId: "vitalArea:1", knownGroups: [], weapons: [club] }).state).toBe("uncovered");
    expect(assessWeaponUse({ maneuverId: "vitalArea:1", knownGroups: ["clubbingWeapons"], weapons: [club] })).toMatchObject({ state: "ok", covered: true });
    expect(assessWeaponUse({ maneuverId: "vitalArea:1", knownGroups: ["clubbingWeapons"], weapons: [{ name: "Rapier", baseName: "" }] }).state).toBe("notAllowed");
  });
  it("Weapon Breaker needs a wielded weapon from a learned group", () => {
    const kat = { name: "Katana", baseName: "" };
    expect(assessWeaponUse({ maneuverId: "weapon:1", knownGroups: [], weapons: [kat] }).state).toBe("needsStyleWeapon");
    expect(assessWeaponUse({ maneuverId: "weapon:1", knownGroups: ["orientalBlades"], weapons: [kat] })).toMatchObject({ state: "ok", covered: true });
  });
  it("picks the first workable weapon when several are wielded, and an unknown maneuver id is treated as any", () => {
    const r = assessWeaponUse({ maneuverId: "vitalArea:1", knownGroups: ["clubbingWeapons"], weapons: [{ name: "Rapier", baseName: "" }, { name: "Club", baseName: "" }] });
    expect(r).toMatchObject({ state: "ok", weaponName: "Club" });
    expect(assessWeaponUse({ maneuverId: "x:1", knownGroups: [], weapons: [sai] }).state).toBe("uncovered");
    expect(assessWeaponUse({ maneuverId: "x:1", knownGroups: ["karateWeapons"], weapons: [sai] }).state).toBe("ok");
  });
  it("under 'any' a covered weapon is preferred over an earlier uncovered one", () => {
    const longSword = { name: "Long Sword", baseName: "" };
    expect(assessWeaponUse({ maneuverId: "block:1", knownGroups: ["karateWeapons"], weapons: [longSword, sai] })).toMatchObject({ state: "ok", weaponName: "Sai +1", covered: true, hitBonus: 2 });
  });
  it("the +2 bonus comes from any covered wielded weapon, not just the first", () => {
    const katana = { name: "Katana", baseName: "" };
    const kusari = { name: "Kusarigama", baseName: "" };
    expect(assessWeaponUse({ maneuverId: "block:3", knownGroups: ["orientalBlades", "chainWeapons"], weapons: [katana, kusari] })).toMatchObject({ state: "ok", hitBonus: 2 });
  });
  it("uncovered-only weapons on an 'any' maneuver are uncovered", () => {
    expect(assessWeaponUse({ maneuverId: "movement:1", knownGroups: [], weapons: [{ name: "Long Sword", baseName: "" }] })).toEqual({ state: "uncovered", weaponName: "Long Sword", covered: false, hitBonus: 0 });
  });
});

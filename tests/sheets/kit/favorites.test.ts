import { describe, expect, it } from "vitest";
import {
  buildFavoriteRows,
  isFavorite,
  normalizeFavorites,
  toggleFavoriteList,
  type FavoriteSources,
} from "../../../src/sheets/kit/favorites";

describe("normalizeFavorites", () => {
  it("returns [] for anything that isn't an array", () => {
    expect(normalizeFavorites(undefined)).toEqual([]);
    expect(normalizeFavorites(null)).toEqual([]);
    expect(normalizeFavorites({ kind: "item", id: "a" })).toEqual([]);
  });
  it("keeps valid entries, drops malformed ones and de-duplicates", () => {
    expect(
      normalizeFavorites([
        { kind: "item", id: "a" },
        { kind: "spell", id: "b" },
        { kind: "thiefSkill", id: "climb-walls" },
        { kind: "item", id: "a" },
        { kind: "bogus", id: "x" },
        { kind: "item", id: "" },
        { kind: "item" },
        null,
        "item:a",
      ]),
    ).toEqual([
      { kind: "item", id: "a" },
      { kind: "spell", id: "b" },
      { kind: "thiefSkill", id: "climb-walls" },
    ]);
  });
});

describe("isFavorite / toggleFavoriteList", () => {
  const list = [{ kind: "item" as const, id: "a" }];
  it("matches on kind AND id", () => {
    expect(isFavorite(list, "item", "a")).toBe(true);
    expect(isFavorite(list, "spell", "a")).toBe(false);
    expect(isFavorite(list, "item", "b")).toBe(false);
  });
  it("adds an entry that isn't there and removes one that is", () => {
    expect(toggleFavoriteList(list, { kind: "spell", id: "s" })).toEqual([
      { kind: "item", id: "a" },
      { kind: "spell", id: "s" },
    ]);
    expect(toggleFavoriteList(list, { kind: "item", id: "a" })).toEqual([]);
  });
});

describe("buildFavoriteRows", () => {
  const sources: FavoriteSources = {
    items: [
      { id: "w1", name: "Long Sword", img: "sword.png", type: "weapon", equipped: true },
      { id: "w2", name: "Dagger", img: "dagger.png", type: "weapon", equipped: false },
      { id: "e1", name: "Rope", img: "rope.png", type: "equipment", equipped: false },
    ],
    spells: [
      { id: "s1", name: "Sleep", img: "sleep.png", canCast: true },
      { id: "s2", name: "Light", img: "light.png", canCast: false },
    ],
    thiefSkills: [
      { skill: "climb-walls", label: "ADND2E.chat.thiefSkill.skills.climbWalls", effective: 85, usable: true },
      { skill: "read-languages", label: "ADND2E.chat.thiefSkill.skills.readLanguages", effective: 0, usable: false },
    ],
  };

  it("builds a row per favorite in list order, with the right one-click action", () => {
    const rows = buildFavoriteRows(
      [
        { kind: "spell", id: "s1" },
        { kind: "item", id: "w1" },
        { kind: "item", id: "w2" },
        { kind: "item", id: "e1" },
        { kind: "spell", id: "s2" },
        { kind: "thiefSkill", id: "climb-walls" },
        { kind: "thiefSkill", id: "read-languages" },
      ],
      sources,
    );
    expect(rows).toEqual([
      { kind: "spell", id: "s1", name: "Sleep", img: "sleep.png", nameIsKey: false, detail: "", action: "castSpell", itemId: "s1", skill: null, icon: "fa-solid fa-dice-d20" },
      { kind: "item", id: "w1", name: "Long Sword", img: "sword.png", nameIsKey: false, detail: "", action: "rollAttack", itemId: "w1", skill: null, icon: "fa-solid fa-dice-d20" },
      { kind: "item", id: "w2", name: "Dagger", img: "dagger.png", nameIsKey: false, detail: "", action: "editItem", itemId: "w2", skill: null, icon: "fa-solid fa-up-right-from-square" },
      { kind: "item", id: "e1", name: "Rope", img: "rope.png", nameIsKey: false, detail: "", action: "editItem", itemId: "e1", skill: null, icon: "fa-solid fa-up-right-from-square" },
      { kind: "spell", id: "s2", name: "Light", img: "light.png", nameIsKey: false, detail: "", action: null, itemId: "s2", skill: null, icon: "" },
      { kind: "thiefSkill", id: "climb-walls", name: "ADND2E.chat.thiefSkill.skills.climbWalls", img: "", nameIsKey: true, detail: "85%", action: "rollThiefSkill", itemId: null, skill: "climb-walls", icon: "fa-solid fa-dice-d20" },
      { kind: "thiefSkill", id: "read-languages", name: "ADND2E.chat.thiefSkill.skills.readLanguages", img: "", nameIsKey: true, detail: "0%", action: null, itemId: null, skill: "read-languages", icon: "" },
    ]);
  });

  it("silently drops favorites whose item, spell or skill no longer exists", () => {
    expect(
      buildFavoriteRows(
        [
          { kind: "item", id: "gone" },
          { kind: "spell", id: "gone" },
          { kind: "thiefSkill", id: "gone" },
        ],
        sources,
      ),
    ).toEqual([]);
  });
});

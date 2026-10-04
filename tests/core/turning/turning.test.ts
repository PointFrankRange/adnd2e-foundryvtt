import { describe, expect, it } from "vitest";
import {
  TURN_ROW_IDS,
  TURN_TABLE,
  allocateAffected,
  levelColumn,
  resolveAttempt,
  resolveTurn,
  turnerLevel,
  turnerLevelFor,
} from "../../../src/core/turning";

describe("TURN_TABLE (PHB Table 61)", () => {
  it("has 13 rows of 12 level columns", () => {
    expect(TURN_ROW_IDS).toHaveLength(13);
    for (const id of TURN_ROW_IDS) expect(TURN_TABLE[id], id).toHaveLength(12);
  });
  it("matches spot-checked cells from the book", () => {
    expect(TURN_TABLE.skeleton[0]).toBe(10);
    expect(TURN_TABLE.skeleton[11]).toBe("D*");
    expect(TURN_TABLE.zombie[8]).toBe("D*");
    expect(TURN_TABLE.wight[11]).toBe("D*");
    expect(TURN_TABLE.ghast[0]).toBeNull();
    expect(TURN_TABLE.ghast[1]).toBe(20);
    expect(TURN_TABLE.lich[7]).toBe(20);
    expect(TURN_TABLE.vampire[11]).toBe(4);
    expect(TURN_TABLE.special[7]).toBeNull();
    expect(TURN_TABLE.special[8]).toBe(20);
    expect(TURN_TABLE.special[11]).toBe(13);
  });
});

describe("levelColumn", () => {
  it("maps levels to columns, clamping at 14+", () => {
    expect(levelColumn(0)).toBe(-1);
    expect(levelColumn(1)).toBe(0);
    expect(levelColumn(9)).toBe(8);
    expect(levelColumn(10)).toBe(9);
    expect(levelColumn(11)).toBe(9);
    expect(levelColumn(12)).toBe(10);
    expect(levelColumn(13)).toBe(10);
    expect(levelColumn(14)).toBe(11);
    expect(levelColumn(30)).toBe(11);
  });
});

describe("turnerLevel / turnerLevelFor", () => {
  it("clerics turn at their level, paladins two lower, nobody else", () => {
    expect(turnerLevel("cleric", 7)).toBe(7);
    expect(turnerLevel("paladin", 5)).toBe(3);
    expect(turnerLevel("paladin", 3)).toBe(1);
    expect(turnerLevel("paladin", 2)).toBeNull();
    expect(turnerLevel("druid", 9)).toBeNull();
    expect(turnerLevel("fighter", 9)).toBeNull();
  });
  it("takes the best level across an actor's classes", () => {
    expect(turnerLevelFor([{ chassisId: "fighter", level: 5 }, { chassisId: "cleric", level: 3 }])).toBe(3);
    expect(turnerLevelFor([{ chassisId: "paladin", level: 5 }, { chassisId: "cleric", level: 2 }])).toBe(3);
    expect(turnerLevelFor([{ chassisId: "mage", level: 5 }])).toBeNull();
    expect(turnerLevelFor([])).toBeNull();
  });
});

describe("resolveTurn", () => {
  it("rolls against a number: equal or higher succeeds", () => {
    expect(resolveTurn(10, 1, "skeleton")).toBe("turned");
    expect(resolveTurn(9, 1, "skeleton")).toBe("fail");
    expect(resolveTurn(4, 5, "ghoul")).toBe("turned");
    expect(resolveTurn(3, 5, "ghoul")).toBe("fail");
  });
  it("T and D need no roll", () => {
    expect(resolveTurn(1, 4, "skeleton")).toBe("turned");
    expect(resolveTurn(1, 6, "skeleton")).toBe("destroyed");
    expect(resolveTurn(1, 8, "skeleton")).toBe("destroyed-bonus");
  });
  it("a dash, or an effective level below 1, cannot turn", () => {
    expect(resolveTurn(20, 1, "ghast")).toBe("cannot");
    expect(resolveTurn(20, 8, "special")).toBe("cannot");
    expect(resolveTurn(20, 0, "skeleton")).toBe("cannot");
  });
  it("levels 14+ use the last column", () => {
    expect(resolveTurn(1, 20, "wight")).toBe("destroyed-bonus");
  });
});

describe("allocateAffected", () => {
  const c = (id: string, hd: number, outcome: "turned" | "destroyed" | "destroyed-bonus" = "turned", row: "skeleton" | "zombie" = "skeleton") =>
    ({ id, row, hd, outcome }) as const;
  it("affects the lowest Hit Dice first, up to the cap", () => {
    expect(allocateAffected([c("a", 3), c("b", 1), c("c", 2)], 2, 0).affected).toEqual(["b", "c"]);
  });
  it("D* adds up to the bonus count of extra creatures of its row", () => {
    const two = [c("a", 1, "destroyed-bonus"), c("b", 1, "destroyed-bonus")];
    expect(allocateAffected(two, 1, 1).affected).toEqual(["a", "b"]);
    expect(allocateAffected(two, 1, 0).affected).toEqual(["a"]);
  });
  it("non-D* creatures past the cap are never affected", () => {
    expect(allocateAffected([c("a", 1), c("b", 1)], 1, 5).affected).toEqual(["a"]);
  });
});

describe("resolveAttempt", () => {
  it("reproduces the PHB example: a 7th-level priest rolls 12 against skeletons, a wight and a spectre", () => {
    const result = resolveAttempt({
      d20: 12,
      level: 7,
      cap: 12,
      bonusCap: 0,
      targets: [
        { id: "s1", isUndead: true, row: "skeleton", hd: 1 },
        { id: "s2", isUndead: true, row: "skeleton", hd: 1 },
        { id: "w", isUndead: true, row: "wight", hd: 5 },
        { id: "sp", isUndead: true, row: "spectre", hd: 8 },
      ],
    });
    expect(result.map((r) => r.status)).toEqual(["destroyed", "destroyed", "turned", "fail"]);
  });
  it("reports non-undead and untagged targets without rolling for them", () => {
    const result = resolveAttempt({
      d20: 20,
      level: 7,
      cap: 12,
      bonusCap: 0,
      targets: [
        { id: "n", isUndead: false, row: null, hd: 2 },
        { id: "u", isUndead: true, row: null, hd: 2 },
      ],
    });
    expect(result.map((r) => r.status)).toEqual(["notUndead", "untagged"]);
  });
  it("marks successful targets past the cap as unaffected", () => {
    const result = resolveAttempt({
      d20: 20,
      level: 7,
      cap: 2,
      bonusCap: 0,
      targets: [
        { id: "a", isUndead: true, row: "skeleton", hd: 3 },
        { id: "b", isUndead: true, row: "skeleton", hd: 1 },
        { id: "c", isUndead: true, row: "skeleton", hd: 2 },
      ],
    });
    expect(result.map((r) => r.status)).toEqual(["unaffected", "destroyed", "destroyed"]);
  });
});

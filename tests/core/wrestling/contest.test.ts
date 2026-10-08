import { describe, expect, it } from "vitest";
import {
  bodyModifier, parseGrappleRecord, resolveOpposed, sideResult, sizeModifier, wrestlingDefenseAc,
} from "../../../src/core/wrestling";

describe("sizeModifier", () => {
  it("is +4 / -4 per size class, from the initiator's point of view", () => {
    expect(sizeModifier("small", "large")).toBe(-8);
    expect(sizeModifier("large", "medium")).toBe(4);
    expect(sizeModifier("medium", "medium")).toBe(0);
  });
  it("treats a missing or unknown size as medium", () => {
    expect(sizeModifier(null, "large")).toBe(-4);
    expect(sizeModifier("bogus", undefined)).toBe(0);
  });
});

describe("bodyModifier", () => {
  it("is -1 for an immune defender, -2 for a supple one, and they stack", () => {
    expect(bodyModifier({})).toBe(0);
    expect(bodyModifier({ immune: true })).toBe(-1);
    expect(bodyModifier({ supple: true })).toBe(-2);
    expect(bodyModifier({ immune: true, supple: true })).toBe(-3);
  });
});

describe("wrestlingDefenseAc", () => {
  it("is 10 plus Dex defensive adjustment minus magic protection, clamped to -10..10", () => {
    expect(wrestlingDefenseAc({ dexDefensiveAdj: 0, magicBonus: 0 })).toBe(10);
    expect(wrestlingDefenseAc({ dexDefensiveAdj: -1, magicBonus: 1 })).toBe(8); // book example: chain mail +1 and Dex 15
    expect(wrestlingDefenseAc({ dexDefensiveAdj: 4, magicBonus: 0 })).toBe(10);
    expect(wrestlingDefenseAc({ dexDefensiveAdj: -4, magicBonus: 30 })).toBe(-10);
  });
});

describe("sideResult", () => {
  it("hits when total reaches thac0 - targetAc, a natural 20 always hits and a natural 1 never does", () => {
    expect(sideResult({ thac0: 17, bonus: 0, targetAc: 10, natural: 7 })).toEqual({ natural: 7, total: 7, hit: true, crit: false });
    expect(sideResult({ thac0: 17, bonus: 0, targetAc: 10, natural: 6 }).hit).toBe(false);
    expect(sideResult({ thac0: 20, bonus: 5, targetAc: -10, natural: 1 }).hit).toBe(false);
    expect(sideResult({ thac0: 20, bonus: 0, targetAc: -10, natural: 20 })).toMatchObject({ hit: true, crit: true });
  });
});

describe("resolveOpposed", () => {
  const anada = (natural: number, bonus: number, targetAc: number) => ({ thac0: 17, bonus, targetAc, natural });
  const bugbear = (natural: number, bonus: number, targetAc: number) => ({ thac0: 17, bonus, targetAc, natural });

  it("both hit: the LOWER total wins (book example, hold check)", () => {
    // Anada: Str +1, one size class smaller (-4), rolls 10 against AC 10; bugbear rolls 18 against AC 8.
    const r = resolveOpposed(anada(10, 1 - 4, 10), bugbear(18, 0, 8));
    expect(r.initiator.hit && r.responder.hit).toBe(true);
    expect(r.winner).toBe("initiator");
    expect(r.critical).toBe(false);
  });

  it("a winning natural 20 is a critical; a losing one is disregarded (book example, breaking free)", () => {
    // Bugbear attacks: +4 size, natural 20; Anada rolls 11 (+1 Str) and wins with the lower total.
    const r = resolveOpposed(bugbear(20, 4, 8), anada(11, 1, 10));
    expect(r.initiator.crit).toBe(true);
    expect(r.winner).toBe("responder");
    expect(r.critical).toBe(false);
  });

  it("exactly one hit: that side wins (book example, lock attempt)", () => {
    const r = resolveOpposed(anada(12, 1, 10), bugbear(2, 0, 8));
    expect(r.responder.hit).toBe(false);
    expect(r.winner).toBe("initiator");
  });

  it("initiator misses and responder hits: responder wins", () => {
    const r = resolveOpposed(anada(2, 0, 10), bugbear(12, 0, 8));
    expect(r.initiator.hit).toBe(false);
    expect(r.responder.hit).toBe(true);
    expect(r.winner).toBe("responder");
  });

  it("a tie or a double miss is no change", () => {
    expect(resolveOpposed(anada(10, 0, 10), bugbear(10, 0, 10)).winner).toBe("none");
    expect(resolveOpposed(anada(2, 0, 10), bugbear(2, 0, 10)).winner).toBe("none");
  });

  it("the winner's natural 20 is the critical; a higher-total natural 20 loses", () => {
    const r = resolveOpposed(anada(20, 0, 10), bugbear(19, 0, 10));
    expect(r.winner).toBe("responder");
    expect(r.critical).toBe(false);
    const r2 = resolveOpposed(anada(20, 0, 10), bugbear(1, 0, 10)); // responder natural 1 misses
    expect(r2.winner).toBe("initiator");
    expect(r2.critical).toBe(true);
  });
});

describe("parseGrappleRecord", () => {
  const good = { id: "g1", role: "holder", opponentUuid: "Actor.x", opponentName: "Bugbear", rung: "held", locks: ["press"], lastLock: "press", pressCount: 2, lockPending: false };
  it("accepts a well-formed record unchanged", () => {
    expect(parseGrappleRecord(good)).toEqual(good);
  });
  it("rejects malformed records", () => {
    for (const bad of [null, [], "x", { ...good, id: "" }, { ...good, role: "x" }, { ...good, rung: "free" }, { ...good, locks: ["bad"] },
      { ...good, locks: "press" }, { ...good, lastLock: "bad" }, { ...good, pressCount: -1 }, { ...good, pressCount: 1.5 }, { ...good, lockPending: "no" },
      { ...good, opponentUuid: "" }, { ...good, opponentName: 3 }]) {
      expect(parseGrappleRecord(bad)).toBeNull();
    }
    expect(parseGrappleRecord({ ...good, lastLock: null })?.lastLock).toBeNull();
  });
});

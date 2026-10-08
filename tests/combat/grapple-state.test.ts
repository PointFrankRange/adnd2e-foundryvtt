import { describe, expect, it } from "vitest";
import { grappleRecordOf } from "../../src/combat/grapple-state";

const record = { id: "g1", role: "holder", opponentUuid: "Actor.x", opponentName: "Bugbear", rung: "held", locks: [], lastLock: null, pressCount: 0, lockPending: false };
const effect = (statuses: string[], flag: unknown) => ({
  statuses: new Set(statuses),
  getFlag: (scope: string, key: string) => (scope === "adnd2e" && key === "grapple" ? flag : undefined),
});

describe("grappleRecordOf", () => {
  it("returns the record carried by a held or grappling effect", () => {
    expect(grappleRecordOf([effect(["prone"], undefined), effect(["grappling"], record)])).toEqual(record);
  });
  it("ignores effects without a valid record, and returns null when there is none", () => {
    expect(grappleRecordOf([effect(["held"], undefined), effect(["held"], { bad: true })])).toBeNull();
    expect(grappleRecordOf([])).toBeNull();
  });
  it("ignores a record on an effect that is neither held nor grappling", () => {
    expect(grappleRecordOf([effect(["stunned"], record)])).toBeNull();
  });
});

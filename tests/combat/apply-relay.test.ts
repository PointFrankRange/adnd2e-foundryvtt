import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYER_APPLY_MODE,
  PLAYER_APPLY_MODES,
  RELAY_CONDITIONS,
  RELAY_QUERY,
  hpDamageUpdate,
  hpHealingUpdate,
  relayEffectText,
  validateRelayRequest,
} from "../../src/combat/apply-relay";

describe("constants", () => {
  it("pins the query name, conditions and apply modes", () => {
    expect(RELAY_QUERY).toBe("adnd2e.applyEffect");
    expect([...RELAY_CONDITIONS]).toEqual(["stunned", "prone", "held", "turned"]);
    expect([...PLAYER_APPLY_MODES]).toEqual(["auto", "approve"]);
    expect(DEFAULT_PLAYER_APPLY_MODE).toBe("auto");
  });
});

describe("validateRelayRequest", () => {
  const t = "Scene.a.Token.b.Actor.c";
  it("accepts every well-formed kind and returns a clean copy", () => {
    expect(validateRelayRequest({ kind: "damage", targetUuid: t, amount: 7, extra: 1 })).toEqual({ kind: "damage", targetUuid: t, amount: 7 });
    expect(validateRelayRequest({ kind: "healing", targetUuid: t, amount: 999 })).toEqual({ kind: "healing", targetUuid: t, amount: 999 });
    expect(validateRelayRequest({ kind: "condition", targetUuid: t, conditionId: "prone" })).toEqual({ kind: "condition", targetUuid: t, conditionId: "prone" });
    expect(validateRelayRequest({ kind: "unequip", targetUuid: t })).toEqual({ kind: "unequip", targetUuid: t });
  });
  it.each([
    null, undefined, 42, "damage", [],
    { kind: "damage", targetUuid: t },
    { kind: "damage", targetUuid: t, amount: 0 },
    { kind: "damage", targetUuid: t, amount: -3 },
    { kind: "damage", targetUuid: t, amount: 1.5 },
    { kind: "healing", targetUuid: t, amount: 1000 },
    { kind: "healing", targetUuid: t, amount: "5" },
    { kind: "condition", targetUuid: t, conditionId: "dead" },
    { kind: "condition", targetUuid: t },
    { kind: "unequip", targetUuid: "" },
    { kind: "unequip" },
    { kind: "teleport", targetUuid: t },
  ])("rejects %j", (raw) => {
    expect(validateRelayRequest(raw)).toBeNull();
  });
});

describe("hpDamageUpdate (moved from chat-listeners, behavior-identical)", () => {
  it("temp HP absorbs damage first and is written when the hp object has a temp key", () => {
    expect(hpDamageUpdate({ value: 20, temp: 5 }, 8)).toEqual({ "system.attributes.hp.value": 17, "system.attributes.hp.temp": 0 });
    expect(hpDamageUpdate({ value: 20, temp: 5 }, 3)).toEqual({ "system.attributes.hp.value": 20, "system.attributes.hp.temp": 2 });
    expect(hpDamageUpdate({ value: 20, temp: 0 }, 4)).toEqual({ "system.attributes.hp.value": 16, "system.attributes.hp.temp": 0 });
  });
  it("writes only value when the hp object has no temp key", () => {
    expect(hpDamageUpdate({ value: 20 }, 4)).toEqual({ "system.attributes.hp.value": 16 });
  });
  it("can drop hit points below zero", () => {
    expect(hpDamageUpdate({ value: 3 }, 10)).toEqual({ "system.attributes.hp.value": -7 });
  });
});

describe("hpHealingUpdate", () => {
  it("adds and caps at max", () => {
    expect(hpHealingUpdate({ value: 5, max: 20 }, 4)).toEqual({ "system.attributes.hp.value": 9 });
    expect(hpHealingUpdate({ value: 18, max: 20 }, 9)).toEqual({ "system.attributes.hp.value": 20 });
  });
});

describe("relayEffectText", () => {
  it("names the effect for the GM log / approval prompt", () => {
    const t = "x";
    expect(relayEffectText({ kind: "damage", targetUuid: t, amount: 7 })).toEqual({ key: "ADND2E.relay.effect.damage", data: { amount: 7 } });
    expect(relayEffectText({ kind: "healing", targetUuid: t, amount: 3 })).toEqual({ key: "ADND2E.relay.effect.healing", data: { amount: 3 } });
    expect(relayEffectText({ kind: "condition", targetUuid: t, conditionId: "held" })).toEqual({ key: "ADND2E.relay.effect.condition", data: { condition: "held" } });
    expect(relayEffectText({ kind: "unequip", targetUuid: t })).toEqual({ key: "ADND2E.relay.effect.unequip", data: {} });
  });
});

describe("destroy requests", () => {
  const t = "Scene.a.Token.b.Actor.c";
  it("validates a destroy request and rejects a missing target", () => {
    expect(validateRelayRequest({ kind: "destroy", targetUuid: t, extra: 1 })).toEqual({ kind: "destroy", targetUuid: t });
    expect(validateRelayRequest({ kind: "destroy", targetUuid: "" })).toBeNull();
  });
  it("accepts the turned condition", () => {
    expect(validateRelayRequest({ kind: "condition", targetUuid: t, conditionId: "turned" })).toEqual({
      kind: "condition", targetUuid: t, conditionId: "turned",
    });
  });
  it("names the destroy effect for the GM log", () => {
    expect(relayEffectText({ kind: "destroy", targetUuid: t })).toEqual({ key: "ADND2E.relay.effect.destroy", data: {} });
  });
});

describe("validateRelayRequest - grapple", () => {
  const rec = { id: "g1", role: "held", opponentUuid: "Actor.a", opponentName: "Anada", rung: "held", locks: [], lastLock: null, pressCount: 0, lockPending: false };
  it("accepts a set request with damage and prone, and a clear request", () => {
    expect(validateRelayRequest({ kind: "grapple", targetUuid: "Actor.t", set: rec, damage: 3, prone: true })).toEqual({
      kind: "grapple", targetUuid: "Actor.t", set: rec, damage: 3, prone: true,
    });
    expect(validateRelayRequest({ kind: "grapple", targetUuid: "Actor.t", set: null, damage: 0, prone: false })).toMatchObject({ set: null, damage: 0 });
  });
  it("rejects a missing or malformed set, damage or prone", () => {
    for (const bad of [
      { kind: "grapple", targetUuid: "Actor.t", damage: 0, prone: false },
      { kind: "grapple", targetUuid: "Actor.t", set: { nope: 1 }, damage: 0, prone: false },
      { kind: "grapple", targetUuid: "Actor.t", set: null, damage: -1, prone: false },
      { kind: "grapple", targetUuid: "Actor.t", set: null, damage: 1000, prone: false },
      { kind: "grapple", targetUuid: "Actor.t", set: null, damage: 1.5, prone: false },
      { kind: "grapple", targetUuid: "Actor.t", set: null, damage: 0, prone: "yes" },
    ]) expect(validateRelayRequest(bad)).toBeNull();
  });
  it("names the effect for the GM log", () => {
    expect(relayEffectText({ kind: "grapple", targetUuid: "Actor.t", set: null, damage: 0, prone: false }).key).toBe("ADND2E.relay.effect.grapple");
  });
});

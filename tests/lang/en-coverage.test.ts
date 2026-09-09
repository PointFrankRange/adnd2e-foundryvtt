import { describe, expect, it } from "vitest";
import enJson from "../../lang/en.json";
import { buildAdnd2eConfig } from "../../src/config";
import { SETTING_DESCRIPTORS } from "../../src/settings/registry";
import { ACTOR_SUBTYPES } from "../../src/data/actor/subtypes";
import { ITEM_SUBTYPES } from "../../src/data/item/subtypes";
import { ACTIVE_EFFECT_SUBTYPES } from "../../src/data/active-effect/subtypes";

const en = enJson as unknown as Record<string, unknown>;

/** Resolve a dotted i18n key against the nested lang object. */
function resolve(key: string): unknown {
  return key.split(".").reduce<unknown>((node, seg) => {
    if (node && typeof node === "object" && seg in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[seg];
    }
    return undefined;
  }, en);
}

/** Every string value reachable from buildAdnd2eConfig() that looks like an i18n key. */
function configLabelKeys(): string[] {
  const cfg = buildAdnd2eConfig() as unknown as Record<string, Record<string, unknown>>;
  const keys: string[] = [];
  for (const entry of Object.values(cfg)) {
    for (const v of Object.values(entry)) {
      if (typeof v === "string" && v.startsWith("ADND2E.")) keys.push(v);
      else if (v && typeof v === "object" && "label" in v) keys.push((v as { label: string }).label);
    }
  }
  return keys;
}

describe("lang/en.json coverage", () => {
  it("resolves every CONFIG.ADND2E label key to a string", () => {
    for (const key of configLabelKeys()) {
      expect(typeof resolve(key), key).toBe("string");
    }
  });

  it("resolves name + hint for every registered setting", () => {
    for (const d of SETTING_DESCRIPTORS) {
      expect(typeof resolve(`ADND2E.settings.${d.key}.name`), d.key).toBe("string");
      expect(typeof resolve(`ADND2E.settings.${d.key}.hint`), d.key).toBe("string");
    }
  });

  it("no longer references the deleted example app", () => {
    expect(JSON.stringify(en)).not.toContain("exampleApp");
    expect(JSON.stringify(en)).not.toContain("exampleSetting");
  });
});

describe("lang/en.json TYPES", () => {
  const types = (en as { TYPES?: { Actor?: object; Item?: object; ActiveEffect?: object } }).TYPES ?? {};

  it("TYPES.Actor keys == ACTOR_SUBTYPES", () => {
    expect(Object.keys(types.Actor ?? {}).sort()).toEqual([...ACTOR_SUBTYPES].sort());
  });
  it("TYPES.Item keys == ITEM_SUBTYPES", () => {
    expect(Object.keys(types.Item ?? {}).sort()).toEqual([...ITEM_SUBTYPES].sort());
  });
  it("TYPES.ActiveEffect keys == ACTIVE_EFFECT_SUBTYPES", () => {
    expect(Object.keys(types.ActiveEffect ?? {}).sort()).toEqual([...ACTIVE_EFFECT_SUBTYPES].sort());
  });
  it("every TYPES value is a non-empty string", () => {
    for (const group of Object.values(types)) {
      for (const [k, v] of Object.entries(group as Record<string, unknown>)) {
        expect(typeof v, k).toBe("string");
        expect((v as string).length, k).toBeGreaterThan(0);
      }
    }
  });
});

describe("lang/en.json — migration + import strings", () => {
  it("resolves every migration + import key the runtime references", () => {
    for (const key of [
      "ADND2E.migration.migrated",
      "ADND2E.migration.dryRunComplete",
      "ADND2E.migration.failed",
      "ADND2E.migration.dryRunSetting.name",
      "ADND2E.migration.dryRunSetting.hint",
      "ADND2E.import.done",
      "ADND2E.import.doneWithFailures",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

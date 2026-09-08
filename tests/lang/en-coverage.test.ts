import { describe, expect, it } from "vitest";
import enJson from "../../lang/en.json";
import { buildAdnd2eConfig } from "../../src/config";
import { SETTING_DESCRIPTORS } from "../../src/settings/registry";

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

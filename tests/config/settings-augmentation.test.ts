import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import enJson from "../../lang/en.json";
import { SETTING_DESCRIPTORS } from "../../src/settings/registry";

const descriptorKeys = SETTING_DESCRIPTORS.map((d) => d.key).sort();

// Registered directly in src/settings/index.ts (not via SETTING_DESCRIPTORS) because
// it is a string choice setting, not a boolean OptionalRules toggle — like
// "adnd2e.systemMigrationVersion" it is invisible to the boolean-only key-contract
// test above, but unlike that setting it IS shown in the config UI (config: true),
// so it legitimately has name/hint/choice-label strings under ADND2E.settings in
// lang/en.json and must be excluded from the orphan-key check below by name.
const NON_OPTIONAL_RULE_SETTING_KEYS = ["playerAppliedEffects"];

describe("settings-key contract", () => {
  it("src/types/global.d.ts SettingConfig covers exactly the registered keys", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../src/types/global.d.ts", import.meta.url)),
      "utf8",
    );
    const augmented = [...src.matchAll(/"adnd2e\.([A-Za-z]+)":\s*boolean/g)]
      .map((m) => m[1])
      .sort();
    expect(augmented).toEqual(descriptorKeys);
  });

  it("lang/en.json has no orphan setting keys", () => {
    const settings = (enJson as unknown as {
      ADND2E: { settings: Record<string, unknown> };
    }).ADND2E.settings;
    expect(Object.keys(settings).sort()).toEqual([...descriptorKeys, ...NON_OPTIONAL_RULE_SETTING_KEYS].sort());
  });
});

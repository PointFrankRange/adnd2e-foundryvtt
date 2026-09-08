import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import enJson from "../../lang/en.json";
import { SETTING_DESCRIPTORS } from "../../src/settings/registry";

const descriptorKeys = SETTING_DESCRIPTORS.map((d) => d.key).sort();

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
    expect(Object.keys(settings).sort()).toEqual(descriptorKeys);
  });
});

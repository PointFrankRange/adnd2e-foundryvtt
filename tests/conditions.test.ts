import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildStatusEffects, CONDITIONS } from "../src/conditions";

const SRC = path.resolve(__dirname, "..", "packs", "conditions", "_source");

function packDocs() {
  return readdirSync(SRC)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(SRC, f), "utf8")) as {
      name: string;
      img: string;
      type: string;
      system: { conditionId: string };
    });
}

describe("CONDITIONS ↔ conditions pack", () => {
  it("the pack has exactly one condition Item per CONDITIONS entry", () => {
    const docs = packDocs();
    expect(docs.length).toBe(CONDITIONS.length);
    const byId = new Map(CONDITIONS.map((c) => [c.id, c]));
    for (const doc of docs) {
      expect(doc.type).toBe("condition");
      const c = byId.get(doc.system.conditionId);
      expect(c, doc.system.conditionId).toBeDefined();
      expect(doc.name).toBe(c!.name);
      expect(doc.img).toBe(c!.img);
    }
    expect(new Set(docs.map((d) => d.system.conditionId)).size).toBe(CONDITIONS.length);
  });
});

describe("buildStatusEffects", () => {
  it("produces one entry per CONDITIONS row, id/name/img matching exactly", () => {
    const effects = buildStatusEffects();
    expect(effects).toHaveLength(CONDITIONS.length);
    for (let i = 0; i < CONDITIONS.length; i++) {
      expect(effects[i]!.id).toBe(CONDITIONS[i]!.id);
      expect(effects[i]!.name).toBe(CONDITIONS[i]!.name);
      expect(effects[i]!.img).toBe(CONDITIONS[i]!.img);
      expect(effects[i]!.type).toBe("adnd2e");
      expect(effects[i]!.hud).toBe(true);
      expect(effects[i]!.system.conditionId).toBe(CONDITIONS[i]!.id);
      expect(effects[i]!.system.isCondition).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CONDITIONS } from "../src/conditions";

const SRC = path.resolve(__dirname, "..", "packs", "conditions", "_source");

function packDocs() {
  return readdirSync(SRC)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(SRC, f), "utf8")) as {
      name: string;
      img: string;
      statuses: string[];
      type: string;
      system: { conditionId: string; isCondition: boolean; changes: unknown[] };
    });
}

describe("CONDITIONS ↔ conditions pack", () => {
  it("the pack has exactly one adnd2e ActiveEffect per CONDITIONS entry", () => {
    const docs = packDocs();
    expect(docs.length).toBe(CONDITIONS.length);
    const byId = new Map(CONDITIONS.map((c) => [c.id, c]));
    for (const doc of docs) {
      expect(doc.type).toBe("adnd2e");
      expect(doc.system.isCondition).toBe(true);
      expect(doc.system.changes).toEqual([]);
      expect(doc.statuses).toEqual([doc.system.conditionId]);
      const c = byId.get(doc.system.conditionId);
      expect(c, doc.system.conditionId).toBeDefined();
      expect(doc.name).toBe(c!.name);
      expect(doc.img).toBe(c!.img);
    }
    expect(new Set(docs.map((d) => d.system.conditionId)).size).toBe(CONDITIONS.length);
  });
});

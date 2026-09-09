import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import manifest from "../../system.json";
import { ITEM_SUBTYPES } from "../../src/data/item/subtypes";
import { ACTIVE_EFFECT_SUBTYPES } from "../../src/data/active-effect/subtypes";

const ROOT = path.resolve(__dirname, "..", "..");
const PACKS = (manifest as unknown as { packs?: { name: string; path: string; type: string }[] }).packs ?? [];

function sourceFiles(packName: string): string[] {
  const dir = path.join(ROOT, "packs", packName, "_source");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f));
}

describe("pack source structure", () => {
  it("system.json packs each have a packs/<name>/_source directory", () => {
    for (const p of PACKS) {
      const dir = path.join(ROOT, "packs", p.name, "_source");
      expect(existsSync(dir) && statSync(dir).isDirectory(), `${p.name}/_source`).toBe(true);
      expect(p.path, p.name).toBe(`packs/${p.name}`);
    }
  });

  it("every _source document parses and has _id / name / type", () => {
    for (const p of PACKS) {
      for (const file of sourceFiles(p.name)) {
        const doc = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
        expect(typeof doc._id, file).toBe("string");
        expect((doc._id as string).length, file).toBe(16);
        expect(/^[A-Za-z0-9]{16}$/.test(doc._id as string), `${file} _id charset`).toBe(true);
        expect(typeof doc.name, file).toBe("string");
        expect((doc.name as string).length, file).toBeGreaterThan(0);
        expect(typeof doc.type, file).toBe("string");
      }
    }
  });

  it("document type matches the pack's declared document type + a registered subtype", () => {
    for (const p of PACKS) {
      for (const file of sourceFiles(p.name)) {
        const doc = JSON.parse(readFileSync(file, "utf8")) as { type: string };
        if (p.type === "Item") expect(ITEM_SUBTYPES as readonly string[], file).toContain(doc.type);
        else if (p.type === "ActiveEffect") expect(ACTIVE_EFFECT_SUBTYPES as readonly string[], file).toContain(doc.type);
        else throw new Error(`${p.name}: unexpected pack type ${p.type}`);
      }
    }
  });

  it("_id values are unique within each pack", () => {
    for (const p of PACKS) {
      const ids = sourceFiles(p.name).map((f) => (JSON.parse(readFileSync(f, "utf8")) as { _id: string })._id);
      expect(new Set(ids).size, p.name).toBe(ids.length);
    }
  });

  it("every packFolders pack reference resolves to a declared pack", () => {
    const declared = new Set(PACKS.map((p) => p.name));
    const folders = (manifest as unknown as { packFolders?: unknown[] }).packFolders ?? [];
    const collect = (node: unknown): string[] => {
      if (!node || typeof node !== "object") return [];
      const n = node as { packs?: string[]; folders?: unknown[] };
      return [...(n.packs ?? []), ...(n.folders ?? []).flatMap(collect)];
    };
    for (const ref of folders.flatMap(collect)) {
      expect(declared.has(ref), `packFolders ref "${ref}"`).toBe(true);
    }
  });
});

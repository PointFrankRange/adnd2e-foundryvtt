import { describe, expect, it } from "vitest";
import { parseImportEnvelope } from "../../src/data/import/envelope";

const spell = { documentType: "Item", type: "spell", name: "Test Bolt" };
const creature = { documentType: "Actor", type: "creature", name: "Test Rat" };

describe("parseImportEnvelope — accepts", () => {
  it("a minimal one-document envelope", () => {
    const r = parseImportEnvelope({ documents: [spell] });
    expect(r).toEqual({ ok: true, documents: [{ documentType: "Item", type: "spell", name: "Test Bolt" }] });
  });

  it("Item and Actor documents together, keeping optional system + img", () => {
    const r = parseImportEnvelope({
      documents: [
        { ...spell, system: { level: 1 }, img: "icons/svg/fire.svg" },
        creature,
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.documents[0]).toEqual({
      documentType: "Item",
      type: "spell",
      name: "Test Bolt",
      system: { level: 1 },
      img: "icons/svg/fire.svg",
    });
    expect(r.documents[1]).toEqual({ documentType: "Actor", type: "creature", name: "Test Rat" });
  });

  it("drops a non-object system and an empty img", () => {
    const r = parseImportEnvelope({ documents: [{ ...spell, system: 3, img: "" }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.documents[0]).toEqual({ documentType: "Item", type: "spell", name: "Test Bolt" });
  });
});

describe("parseImportEnvelope — rejects with a specific message", () => {
  it("a non-object", () => {
    expect(parseImportEnvelope("nope")).toEqual({ ok: false, error: "import data must be a JSON object" });
    expect(parseImportEnvelope(null)).toEqual({ ok: false, error: "import data must be a JSON object" });
    expect(parseImportEnvelope([spell])).toEqual({ ok: false, error: "import data must be a JSON object" });
  });

  it("a missing or non-array documents field", () => {
    expect(parseImportEnvelope({})).toEqual({
      ok: false,
      error: 'import data must have a "documents" array',
    });
    expect(parseImportEnvelope({ documents: {} })).toEqual({
      ok: false,
      error: 'import data must have a "documents" array',
    });
  });

  it("an empty documents array", () => {
    expect(parseImportEnvelope({ documents: [] })).toEqual({
      ok: false,
      error: '"documents" is empty — nothing to import',
    });
  });

  it("a non-object entry", () => {
    expect(parseImportEnvelope({ documents: [spell, 7] })).toEqual({
      ok: false,
      error: "documents[1] is not an object",
    });
  });

  it("a bad documentType", () => {
    expect(parseImportEnvelope({ documents: [{ documentType: "JournalEntry", type: "x", name: "y" }] })).toEqual({
      ok: false,
      error: 'documents[0].documentType must be "Item" or "Actor"',
    });
  });

  it("a missing / empty type", () => {
    expect(parseImportEnvelope({ documents: [{ documentType: "Item", name: "y" }] })).toEqual({
      ok: false,
      error: "documents[0].type must be a non-empty string",
    });
    expect(parseImportEnvelope({ documents: [{ documentType: "Item", type: "", name: "y" }] })).toEqual({
      ok: false,
      error: "documents[0].type must be a non-empty string",
    });
  });

  it("a missing / empty name", () => {
    expect(parseImportEnvelope({ documents: [{ documentType: "Item", type: "spell" }] })).toEqual({
      ok: false,
      error: "documents[0].name must be a non-empty string",
    });
    expect(parseImportEnvelope({ documents: [{ documentType: "Item", type: "spell", name: "" }] })).toEqual({
      ok: false,
      error: "documents[0].name must be a non-empty string",
    });
  });
});

// The `importContent` envelope parser (spec §7). Pure structural validation of
// the JSON a GM passes to `game.system.api.importContent()`. Subtype validity and
// per-document schema validation happen in the Foundry glue
// (`src/api/import-content.ts`) — they need CONFIG. No Foundry import — pure,
// gated, 100% covered.

/** One document the caller wants created. */
export interface RawImportDoc {
  documentType: "Item" | "Actor";
  type: string;
  name: string;
  system?: Record<string, unknown>;
  img?: string;
}

export type ParseResult =
  | { ok: true; documents: RawImportDoc[] }
  | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate the outer shape of import JSON. On success, returns a normalised
 * `documents` array (optional `system` / `img` present only when well-formed).
 */
export function parseImportEnvelope(json: unknown): ParseResult {
  if (!isObject(json)) return { ok: false, error: "import data must be a JSON object" };
  const { documents } = json;
  if (!Array.isArray(documents)) return { ok: false, error: 'import data must have a "documents" array' };
  if (documents.length === 0) return { ok: false, error: '"documents" is empty — nothing to import' };

  const out: RawImportDoc[] = [];
  for (let i = 0; i < documents.length; i++) {
    const d: unknown = documents[i];
    if (!isObject(d)) return { ok: false, error: `documents[${i}] is not an object` };
    if (d.documentType !== "Item" && d.documentType !== "Actor") {
      return { ok: false, error: `documents[${i}].documentType must be "Item" or "Actor"` };
    }
    if (typeof d.type !== "string" || d.type.length === 0) {
      return { ok: false, error: `documents[${i}].type must be a non-empty string` };
    }
    if (typeof d.name !== "string" || d.name.length === 0) {
      return { ok: false, error: `documents[${i}].name must be a non-empty string` };
    }
    const doc: RawImportDoc = { documentType: d.documentType, type: d.type, name: d.name };
    if (isObject(d.system)) doc.system = d.system;
    if (typeof d.img === "string" && d.img.length > 0) doc.img = d.img;
    out.push(doc);
  }
  return { ok: true, documents: out };
}

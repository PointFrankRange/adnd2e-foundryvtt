// The public content importer (spec §7). GM passes a JSON envelope (validated by
// the pure `parseImportEnvelope`); this creates the documents in a world folder,
// one at a time so a single bad document does not abort the batch. Create-only —
// re-importing the same file makes duplicates. Not unit-tested (spec §9).
import { SYSTEM_ID } from "../constants";
import { parseImportEnvelope, type RawImportDoc } from "../data/import/envelope";

export interface ImportedRef {
  id: string;
  name: string;
  type: string;
  documentType: "Item" | "Actor";
}
export interface ImportFailure {
  index: number;
  name: string;
  error: string;
}
export interface ImportResult {
  created: ImportedRef[];
  failed: ImportFailure[];
  folders: { Item?: string; Actor?: string };
}

const DEFAULT_FOLDER_NAME = "Imported Content";

async function getOrCreateFolder(documentType: "Item" | "Actor", name: string) {
  const existing = game.folders!.find((f) => f.type === documentType && f.name === name);
  if (existing) return existing;
  const created = await CONFIG.Folder.documentClass.create({ name, type: documentType });
  if (!created) throw new Error(`could not create the "${name}" ${documentType} folder`);
  return created;
}

/**
 * Import documents from a validated JSON envelope. GM-only. Returns a summary and
 * also posts a notification; per-document failures are collected, not thrown.
 */
export async function importContent(
  json: unknown,
  options: { folderName?: string } = {},
): Promise<ImportResult> {
  if (!game.user?.isGM) throw new Error("importContent is GM-only");

  const parsed = parseImportEnvelope(json);
  if (!parsed.ok) throw new Error(parsed.error);

  const folderName = options.folderName ?? DEFAULT_FOLDER_NAME;
  const result: ImportResult = { created: [], failed: [], folders: {} };
  const folderIdByType: Partial<Record<"Item" | "Actor", string | null>> = {};

  for (const dt of ["Item", "Actor"] as const) {
    if (parsed.documents.some((d) => d.documentType === dt)) {
      const folder = await getOrCreateFolder(dt, folderName);
      folderIdByType[dt] = folder.id;
      if (folder.id) result.folders[dt] = folder.id;
    }
  }

  for (let i = 0; i < parsed.documents.length; i++) {
    const d: RawImportDoc = parsed.documents[i];
    try {
      const cfg = d.documentType === "Item" ? CONFIG.Item : CONFIG.Actor;
      const models = cfg.dataModels as Record<string, unknown>;
      if (!(d.type in models)) {
        throw new Error(`unknown ${d.documentType} subtype "${d.type}"`);
      }
      const createData = {
        name: d.name,
        type: d.type,
        folder: folderIdByType[d.documentType] ?? null,
        ...(d.img ? { img: d.img } : {}),
        ...(d.system ? { system: d.system } : {}),
      };
      const doc =
        d.documentType === "Item"
          ? await CONFIG.Item.documentClass.create(createData as Item.CreateData)
          : await CONFIG.Actor.documentClass.create(createData as Actor.CreateData);
      if (!doc?.id) {
        throw new Error("document creation returned nothing (schema validation failed?)");
      }
      result.created.push({
        id: doc.id,
        name: doc.name ?? d.name,
        type: d.type,
        documentType: d.documentType,
      });
    } catch (err) {
      result.failed.push({
        index: i,
        name: d.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const total = parsed.documents.length;
  const key = result.failed.length ? "ADND2E.import.doneWithFailures" : "ADND2E.import.done";
  ui.notifications!.info(
    game.i18n!.format(key, {
      created: String(result.created.length),
      total: String(total),
      failed: String(result.failed.length),
    }),
  );
  if (result.failed.length) console.warn(`${SYSTEM_ID} | import failures`, result.failed);

  return result;
}

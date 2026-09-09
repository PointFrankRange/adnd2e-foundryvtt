// The SP1 stub sheet (spec §4, §12.8): walks a document's `system` DataModel
// schema and renders one input per leaf field so data can be hand-entered for
// testing. Scalars use typed inputs; arrays/objects use a JSON textarea. No
// designed layout — real sheets are SP2 (PC) / SP6 (NPC/monster). Foundry-coupled
// (the walk is `instanceof foundry.data.fields.*`); no unit tests (spec §9) —
// verified in a linked dev world.

const fields = foundry.data.fields;
const { getProperty, setProperty, deleteProperty } = foundry.utils;

type RowKind = "text" | "textarea" | "number" | "checkbox" | "select" | "json";

interface FieldRow {
  /** dot-path used as the input `name` and as the update key: "name", "img", "system.<path>" */
  path: string;
  label: string;
  indent: number; // px, = depth * 12
  header?: boolean; // a SchemaField group heading — no input
  kind?: RowKind;
  value?: unknown;
  choices?: { value: string; label: string; selected: boolean }[];
}

/** "chassisId" -> "Chassis Id", "hp_rolls" -> "Hp Rolls". */
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Normalise a StringField's `choices` (array | object | function) to option rows. */
function toChoiceRows(raw: unknown, current: unknown): FieldRow["choices"] {
  let entries: [string, string][];
  const resolved = typeof raw === "function" ? (raw as () => unknown)() : raw;
  if (Array.isArray(resolved)) entries = resolved.map((v) => [String(v), String(v)]);
  else if (resolved && typeof resolved === "object") {
    entries = Object.entries(resolved as Record<string, unknown>).map(([k, v]) => [k, String(v)]);
  } else return undefined;
  return entries.map(([value, label]) => ({ value, label, selected: value === String(current ?? "") }));
}

/** True for a field that should be rendered as a single JSON textarea (not walked). */
function isComplexField(field: unknown): boolean {
  return (
    field instanceof fields.ArrayField ||
    field instanceof fields.ObjectField ||
    field instanceof fields.SetField ||
    field instanceof fields.TypedObjectField
  );
}

function walk(
  schema: foundry.data.fields.SchemaField.Any,
  doc: foundry.abstract.Document.Any,
  prefix: string, // "system" or "system.<...>"
  depth: number,
  out: FieldRow[],
): void {
  for (const [key, field] of Object.entries(schema.fields)) {
    const path = `${prefix}.${key}`;
    const value = getProperty(doc, path);

    if (field instanceof fields.SchemaField) {
      out.push({ path, label: humanizeKey(key), indent: depth * 12, header: true });
      walk(field, doc, path, depth + 1, out);
      continue;
    }
    if (isComplexField(field)) {
      out.push({
        path,
        label: humanizeKey(key),
        indent: depth * 12,
        kind: "json",
        value: JSON.stringify(value ?? null, null, 2),
      });
      continue;
    }
    if (field instanceof fields.BooleanField) {
      out.push({ path, label: humanizeKey(key), indent: depth * 12, kind: "checkbox", value: Boolean(value) });
      continue;
    }
    if (field instanceof fields.NumberField) {
      out.push({ path, label: humanizeKey(key), indent: depth * 12, kind: "number", value: value ?? "" });
      continue;
    }
    if (field instanceof fields.StringField) {
      const choices = toChoiceRows((field as unknown as { choices?: unknown }).choices, value);
      if (choices && choices.length) {
        out.push({ path, label: humanizeKey(key), indent: depth * 12, kind: "select", value, choices });
      } else {
        const kind: RowKind = field instanceof fields.HTMLField ? "textarea" : "text";
        out.push({ path, label: humanizeKey(key), indent: depth * 12, kind, value: value ?? "" });
      }
      continue;
    }
    // Unknown / unhandled field type — fall back to JSON so it is at least visible & editable.
    out.push({
      path,
      label: humanizeKey(key),
      indent: depth * 12,
      kind: "json",
      value: JSON.stringify(value ?? null, null, 2),
    });
  }
}

/** Build the flat row list for a document: top-level name/img + the whole `system` tree. */
function buildFieldRows(doc: foundry.abstract.Document.Any): FieldRow[] {
  const rows: FieldRow[] = [];
  rows.push({ path: "name", label: "Name", indent: 0, kind: "text", value: (doc as { name?: string }).name ?? "" });
  const docSchema = (doc as unknown as { schema?: { fields?: Record<string, unknown> } }).schema;
  if (docSchema?.fields && "img" in docSchema.fields) {
    rows.push({ path: "img", label: "Image", indent: 0, kind: "text", value: (doc as { img?: string }).img ?? "" });
  }
  const sys = (doc as unknown as { system?: { schema?: foundry.data.fields.SchemaField.Any } }).system;
  if (sys?.schema) {
    rows.push({ path: "system", label: "System", indent: 0, header: true });
    walk(sys.schema, doc, "system", 1, rows);
  }
  return rows;
}

/**
 * Adds raw-field rendering + JSON-textarea round-tripping to any v14 DocumentSheetV2
 * subclass (ActorSheetV2 / ItemSheetV2 / ActiveEffectConfig).
 */
export function RawFieldSheetMixin<TBase extends abstract new (...args: never[]) => object>(Base: TBase) {
  const Mixed = foundry.applications.api.HandlebarsApplicationMixin(Base as never);

  abstract class RawFieldSheet extends (Mixed as unknown as new (...args: never[]) => {
    _prepareContext(options: unknown): Promise<Record<string, unknown>>;
    _processFormData(event: unknown, form: HTMLFormElement, formData: unknown): Record<string, unknown>;
    document: foundry.abstract.Document.Any;
  }) {
    static DEFAULT_OPTIONS = {
      position: { width: 560, height: 680 },
      window: { resizable: true },
      form: { closeOnSubmit: false },
    };

    static PARTS = {
      body: { template: "systems/adnd2e/templates/sheets/raw-fields.hbs", scrollable: [""] },
    };

    override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
      const context = await super._prepareContext(options);
      context.rows = buildFieldRows(this.document);
      return context;
    }

    override _processFormData(
      event: unknown,
      form: HTMLFormElement,
      formData: unknown,
    ): Record<string, unknown> {
      const submitData = super._processFormData(event, form, formData);
      for (const el of Array.from(form.querySelectorAll<HTMLTextAreaElement>('[data-json="true"]'))) {
        const path = el.name;
        try {
          setProperty(submitData, path, JSON.parse(el.value));
        } catch {
          deleteProperty(submitData, path);
          ui.notifications?.error(game.i18n!.format("ADND2E.sheets.badJson", { field: path }));
        }
      }
      return submitData;
    }
  }

  return RawFieldSheet as unknown as TBase &
    (new (...args: never[]) => InstanceType<typeof RawFieldSheet>);
}

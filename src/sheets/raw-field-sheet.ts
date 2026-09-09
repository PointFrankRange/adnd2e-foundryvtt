// The SP1 stub sheet (spec §4, §12.8): walks a document's `system` DataModel
// schema and renders one input per leaf field so data can be hand-entered for
// testing. Scalars use typed inputs; arrays/objects use a JSON textarea. No
// designed layout — real sheets are SP2 (PC) / SP6 (NPC/monster). Foundry-coupled
// (the walk is `instanceof foundry.data.fields.*`); no unit tests (spec §9) —
// verified in a linked dev world.
//
// Field *values* are read from the document's authored source (`document._source`,
// exposed by DocumentSheetV2 as `context.source`), never the prepared model: the
// prepared model has racially-adjusted ability scores and derived-overwritten
// fields baked in, and saving those would corrupt `_source`. The *schema*
// (structure) still comes from the live model — it carries no values.

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
  /** a nullable `choices` field — its <select> gets `data-null="true"` so "" round-trips to null */
  nullable?: boolean;
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
  // NB: SetField's runtime value is a Set, so `JSON.stringify` would emit `{}` not
  // `[]`; a future adnd2e schema with a SetField would need `[...value]` handling
  // before stringify. No SetField exists in any current adnd2e schema.
  return (
    field instanceof fields.ArrayField ||
    field instanceof fields.ObjectField ||
    field instanceof fields.SetField ||
    field instanceof fields.TypedObjectField
  );
}

function walk(
  schema: foundry.data.fields.SchemaField.Any,
  source: Record<string, unknown>, // the document's `_source` object
  prefix: string, // "system" or "system.<...>"
  depth: number,
  out: FieldRow[],
): void {
  for (const [key, field] of Object.entries(schema.fields)) {
    const path = `${prefix}.${key}`;
    const value = getProperty(source, path);

    if (field instanceof fields.SchemaField) {
      const nullable = (field as unknown as { nullable?: boolean }).nullable === true;
      if (nullable && (value === null || value === undefined)) {
        // A currently-null nullable SchemaField (e.g. weapon.range): render one JSON
        // textarea. Recursing would emit empty number inputs that flip null -> {0,0,0}
        // on Save. To set it, paste an object into the textarea.
        out.push({
          path,
          label: humanizeKey(key),
          indent: depth * 12,
          kind: "json",
          value: JSON.stringify(value ?? null, null, 2),
        });
      } else {
        out.push({ path, label: humanizeKey(key), indent: depth * 12, header: true });
        walk(field, source, path, depth + 1, out);
      }
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
      const numChoices = (field as unknown as { choices?: unknown }).choices;
      if (Array.isArray(numChoices) && numChoices.length) {
        // e.g. weapon.handsRequired = NumberField({ choices: [1, 2] }). A free number
        // input lets an out-of-range value abort the whole save; render a <select>
        // instead (its string value round-trips and NumberField#_cast coerces it back).
        const nullable = (field as unknown as { nullable?: boolean }).nullable === true;
        const choices = numChoices.map((v) => ({
          value: String(v),
          label: String(v),
          selected: Number(v) === Number(value),
        }));
        if (nullable) {
          choices.unshift({
            value: "",
            label: "—",
            selected: value === null || value === undefined,
          });
        }
        out.push({ path, label: humanizeKey(key), indent: depth * 12, kind: "select", value, choices, nullable });
        continue;
      }
      out.push({ path, label: humanizeKey(key), indent: depth * 12, kind: "number", value: value ?? "" });
      continue;
    }
    if (field instanceof fields.StringField) {
      const choices = toChoiceRows((field as unknown as { choices?: unknown }).choices, value);
      if (choices && choices.length) {
        const nullable = (field as unknown as { nullable?: boolean }).nullable === true;
        if (nullable) {
          // A bare blank <option value=""> alone throws `"" is not a valid choice`
          // and aborts the save; pair it with `data-null="true"` (template) so the
          // mixin's _processFormData rewrites "" -> null before validation.
          for (const c of choices) c.selected = String(c.value) === String(value);
          choices.unshift({
            value: "",
            label: "—",
            selected: value === null || value === undefined,
          });
        }
        out.push({ path, label: humanizeKey(key), indent: depth * 12, kind: "select", value, choices, nullable });
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
function buildFieldRows(
  doc: foundry.abstract.Document.Any,
  source: Record<string, unknown>,
): FieldRow[] {
  const rows: FieldRow[] = [];
  rows.push({ path: "name", label: "Name", indent: 0, kind: "text", value: getProperty(source, "name") ?? "" });
  const docSchema = (doc as unknown as { schema?: { fields?: Record<string, unknown> } }).schema;
  if (docSchema?.fields && "img" in docSchema.fields) {
    rows.push({ path: "img", label: "Image", indent: 0, kind: "text", value: getProperty(source, "img") ?? "" });
  }
  const sys = (doc as unknown as { system?: { schema?: foundry.data.fields.SchemaField.Any } }).system;
  if (sys?.schema) {
    rows.push({ path: "system", label: "System", indent: 0, header: true });
    walk(sys.schema, source, "system", 1, rows);
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
      const source = (context.source ??
        (this.document as { _source?: unknown })._source) as Record<string, unknown>;
      context.rows = buildFieldRows(this.document, source);
      return context;
    }

    /**
     * Round-trips nullable `choices` <select>s ("" -> null) and JSON textareas.
     *
     * The per-field try/catch below isolates *unparseable* textarea text only. JSON
     * that parses but fails DataModel validation still aborts the whole save inside
     * `_prepareSubmitData` — correct for a raw editor (no partial writes), not a
     * per-field concern.
     */
    override _processFormData(
      event: unknown,
      form: HTMLFormElement,
      formData: unknown,
    ): Record<string, unknown> {
      const submitData = super._processFormData(event, form, formData);
      for (const el of Array.from(form.querySelectorAll<HTMLSelectElement>('select[data-null="true"]'))) {
        if (el.value === "") setProperty(submitData, el.name, null);
      }
      for (const el of Array.from(form.querySelectorAll<HTMLTextAreaElement>('[data-json="true"]'))) {
        const path = el.name;
        if (el.value.trim() === "") {
          deleteProperty(submitData, path);
          continue;
        }
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

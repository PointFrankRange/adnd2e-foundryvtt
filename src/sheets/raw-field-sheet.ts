// The SP1 stub sheet (spec §4, §12.8): walks a document's `system` DataModel
// schema and renders one input per leaf field so data can be hand-entered for
// testing. Scalars use typed inputs; known list/object fields (LINE_FIELDS) use a
// one-entry-per-line textarea; a nullable group uses a "Set" checkbox that toggles
// its children; any other array/object uses a JSON textarea. No
// designed layout — real sheets are SP2 (PC) / SP6 (NPC/monster). Foundry-coupled
// (the walk is `instanceof foundry.data.fields.*`); no unit tests (spec §9) —
// verified in a linked dev world.
//
// Field *values* are read from the document's authored source (`document._source`,
// exposed by DocumentSheetV2 as `context.source`), never the prepared model: the
// prepared model has racially-adjusted ability scores and derived-overwritten
// fields baked in, and saving those would corrupt `_source`. The *schema*
// (structure) still comes from the live model — it carries no values.

import { CLASS_IDS } from "../data/item/choices";

const fields = foundry.data.fields;
const { getProperty, setProperty, deleteProperty } = foundry.utils;

type RowKind =
  | "text"
  | "textarea"
  | "number"
  | "checkbox"
  | "select"
  | "multiselect"
  | "json"
  | "nullcheck"
  | "lines";

/** How a "lines" textarea is parsed back: one entry per line, or a structured line. */
type LineMode = "text" | "number" | "multiclass" | "levels";

/**
 * Item fields edited as a textarea, keyed by document path. Anything not listed
 * here keeps the generic handling (scalars, selects, multiselects, JSON fallback).
 */
const LINE_FIELDS: Record<string, LineMode> = {
  "system.grantedFeatures": "text", // class, race
  "system.bonusLanguages": "text", // race
  "system.effectRefs": "text", // class-feature
  "system.automation.effectRefs": "text", // spell
  "system.hpRolls": "number", // class
  "system.allowedMulticlass": "multiclass", // race: one "a, b" combination per line
  "system.classLevelLimits": "levels", // race: one "classId: number" per line
};

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
  /** a "lines" row's parser mode (copied to `data-lines` on the textarea) */
  lineMode?: LineMode;
  /** a child of a nullable group: the group's dot-path (its toggle is `data-null-toggle`) */
  nullGroup?: string;
  /** a child of a nullable group that starts hidden because the group is unset */
  hidden?: boolean;
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

/** True for a StringField whose entries are a fixed choice list (a multi-select candidate). */
function isChoiceElement(element: unknown): boolean {
  return element instanceof fields.StringField && Boolean((element as unknown as { choices?: unknown }).choices);
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

/** The textarea text for a LINE_FIELDS value (inverse of {@link parseLines}). */
function formatLines(value: unknown, mode: LineMode): string {
  if (mode === "levels") {
    if (!value || typeof value !== "object") return "";
    return Object.entries(value as Record<string, unknown>)
      .map(([id, n]) => `${id}: ${String(n ?? "null")}`)
      .join("\n");
  }
  if (!Array.isArray(value)) return "";
  if (mode === "multiclass") {
    return value.map((combo) => (Array.isArray(combo) ? combo.join(", ") : "")).join("\n");
  }
  return value.join("\n");
}

type ParseResult = { ok: true; value: unknown } | { ok: false };

/**
 * Parse a LINE_FIELDS textarea. Blank lines are dropped. Any unknown class id, a
 * non-numeric number, or a malformed "classId: number" line fails the whole field
 * (the caller then leaves the stored value untouched and reports it).
 */
function parseLines(text: string, mode: LineMode): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const isClassId = (id: string): boolean => (CLASS_IDS as readonly string[]).includes(id);
  switch (mode) {
    case "text":
      return { ok: true, value: lines };
    case "number": {
      const nums = lines.map((l) => Number(l));
      return nums.every((n) => Number.isFinite(n)) ? { ok: true, value: nums } : { ok: false };
    }
    case "multiclass": {
      const combos = lines.map((l) => l.split(",").map((s) => s.trim()));
      return combos.every((c) => c.every(isClassId)) ? { ok: true, value: combos } : { ok: false };
    }
    case "levels": {
      const limits: Record<string, number | null> = {};
      for (const line of lines) {
        const colon = line.indexOf(":");
        if (colon < 0) return { ok: false };
        const id = line.slice(0, colon).trim();
        const raw = line.slice(colon + 1).trim();
        if (!isClassId(id)) return { ok: false };
        if (raw === "null") {
          limits[id] = null;
          continue;
        }
        const n = Number(raw);
        if (raw === "" || !Number.isFinite(n)) return { ok: false };
        limits[id] = n;
      }
      return { ok: true, value: limits };
    }
  }
}

/** A child's initial value for each key of a SchemaField (what a null group shows). */
function initialsOf(schema: foundry.data.fields.SchemaField.Any): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(schema.fields).map(([key, f]) => [
      key,
      (f as unknown as { getInitialValue(source: object): unknown }).getInitialValue({}),
    ]),
  );
}

function walk(
  schema: foundry.data.fields.SchemaField.Any,
  source: Record<string, unknown>, // the document's `_source` object
  prefix: string, // "system" or "system.<...>"
  depth: number,
  out: FieldRow[],
  initials?: Record<string, unknown>, // a null nullable group's children show these instead
): void {
  for (const [key, field] of Object.entries(schema.fields)) {
    const path = `${prefix}.${key}`;
    const value = getProperty(source, path) ?? initials?.[key];

    if (field instanceof fields.SchemaField) {
      const nullable = (field as unknown as { nullable?: boolean }).nullable === true;
      if (nullable) {
        // A nullable group (e.g. weapon.range): a "Set" checkbox heads it. Its children
        // always render (hidden while unset) so ticking the box needs no re-save; an
        // unset group is saved as null, a set one as the children's object.
        const isSet = value !== null && value !== undefined;
        out.push({ path, label: humanizeKey(key), indent: depth * 12, kind: "nullcheck", value: isSet });
        const start = out.length;
        walk(field, source, path, depth + 1, out, isSet ? undefined : initialsOf(field));
        for (const row of out.slice(start)) {
          row.nullGroup = path;
          row.hidden = !isSet;
        }
      } else {
        out.push({ path, label: humanizeKey(key), indent: depth * 12, header: true });
        walk(field, source, path, depth + 1, out);
      }
      continue;
    }
    const lineMode = LINE_FIELDS[path];
    if (lineMode) {
      out.push({
        path,
        label: humanizeKey(key),
        indent: depth * 12,
        kind: "lines",
        lineMode,
        value: formatLines(value, lineMode),
      });
      continue;
    }
    if (field instanceof fields.ArrayField && isChoiceElement(field.element)) {
      // e.g. spell schools/spheres: a fixed choice list per entry. Render a
      // multi-select instead of a JSON textarea so a typo cannot abort the save.
      const current = Array.isArray(value) ? value.map(String) : [];
      const choices = toChoiceRows((field.element as unknown as { choices?: unknown }).choices, undefined) ?? [];
      out.push({
        path,
        label: humanizeKey(key),
        indent: depth * 12,
        kind: "multiselect",
        value: current,
        choices: choices.map((c) => ({ ...c, selected: current.includes(c.value) })),
      });
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
        const blank = (field as unknown as { blank?: boolean }).blank === true;
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
        } else if (blank && !choices.some((c) => c.value === "")) {
          // Not nullable, but "" is itself a valid stored value for a blank
          // field (its own "unset" sentinel) — unlike the nullable case
          // above, no data-null round-trip is needed, the <select> submits ""
          // directly and the field already accepts it. Without this, an
          // unset value has no matching <option> and the browser silently
          // defaults to the first real choice, which then overwrites the
          // blank value on the next unrelated save. Skipped when "" is
          // already an explicit member of `choices` (e.g. creature.ts's
          // `group` field) to avoid a redundant second blank option.
          choices.unshift({
            value: "",
            label: "—",
            selected: value === "" || value === undefined,
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
    element: HTMLElement;
    _prepareContext(options: unknown): Promise<Record<string, unknown>>;
    _onRender(context: unknown, options: unknown): Promise<void>;
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

    /** Wires each nullable group's "Set" checkbox to show/hide its child rows live. */
    override async _onRender(context: unknown, options: unknown): Promise<void> {
      await super._onRender(context, options);
      for (const toggle of Array.from(this.element.querySelectorAll<HTMLInputElement>("input[data-null-toggle]"))) {
        toggle.addEventListener("change", () => {
          for (const row of Array.from(
            this.element.querySelectorAll<HTMLElement>(`[data-null-group="${toggle.dataset.nullToggle ?? ""}"]`),
          )) {
            row.style.display = toggle.checked ? "" : "none";
          }
        });
      }
    }

    /**
     * Round-trips nullable `choices` <select>s ("" -> null), nullable-group toggles
     * (unchecked -> null), LINE_FIELDS textareas, and JSON textareas.
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
      for (const el of Array.from(form.querySelectorAll<HTMLInputElement>("input[data-null-toggle]"))) {
        // A checked group's children already arrived as the nested object (their
        // names are the schema keys); only an unchecked group needs forcing to null.
        if (!el.checked && el.dataset.nullToggle) setProperty(submitData, el.dataset.nullToggle, null);
      }
      for (const el of Array.from(form.querySelectorAll<HTMLDetailsElement>('details[data-multiselect="true"]'))) {
        const picked = Array.from(el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'), (i) => i.value);
        setProperty(submitData, el.dataset.path ?? "", picked);
      }
      for (const el of Array.from(form.querySelectorAll<HTMLTextAreaElement>("textarea[data-lines]"))) {
        const path = el.name;
        const parsed = parseLines(el.value, el.dataset.lines as LineMode);
        if (parsed.ok) {
          setProperty(submitData, path, parsed.value);
        } else {
          deleteProperty(submitData, path);
          ui.notifications?.error(game.i18n!.format("ADND2E.sheets.badJson", { field: path }));
        }
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

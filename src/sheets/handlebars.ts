import { TEMPLATE_PATH } from "../constants";

// Sheet partials shipped with SP2 and later. Registered under short
// `adnd2e.<name>` ids so templates can `{{> adnd2e.pc-ability ability=a}}`.
const PARTIALS = [
  "actor/shared/partials/slot-table.hbs",
  "actor/shared/partials/item-controls.hbs",
  "actor/pc/partials/pc-ability.hbs",
  "actor/pc/partials/pc-class-row.hbs",
  "actor/pc/partials/pc-item-table.hbs",
  "actor/pc/partials/pc-encumbrance.hbs",
  "actor/pc/partials/pc-main-panels.hbs",
  "actor/pc/partials/pc-proficiency-panels.hbs",
  "actor/pc/partials/pc-feature-panels.hbs",
  "actor/pc/partials/pc-journal-panels.hbs",
];

/**
 * Register the SP2 sheet partials as named Handlebars partials + a couple of
 * display helpers. Call once from the `setup` hook (before any sheet renders).
 */
export async function registerSheetPartials(): Promise<void> {
  const paths: Record<string, string> = {};
  for (const rel of PARTIALS) {
    const id = `adnd2e.${rel.split("/").pop()!.replace(".hbs", "")}`;
    paths[id] = TEMPLATE_PATH(rel);
  }
  await foundry.applications.handlebars.loadTemplates(paths);

  Handlebars.registerHelper("adnd2ePct", (v: unknown) => `${Math.round(Number(v) * 100)}%`);
  Handlebars.registerHelper("adnd2eSigned", (v: unknown) => {
    const n = Number(v);
    return n > 0 ? `+${n}` : String(n);
  });
  // sheet redesign R2 fix wave: locked-view display for a numeric field that
  // may legitimately be 0 — plain `{{#if}}` treats 0 as falsy, so this checks
  // for null/undefined/empty specifically instead.
  Handlebars.registerHelper("adnd2eOrDash", (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v)));
}

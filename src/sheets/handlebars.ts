import { TEMPLATE_PATH } from "../constants";

// Sheet partials shipped with SP2. Registered under short `adnd2e.<name>` ids so
// templates can `{{> adnd2e.ability-row row=row}}`. Task 7 adds slot-table here
// as it fills in the Skills/Spells tabs.
const PARTIALS = [
  "actor/character/partials/ability-row.hbs",
  "actor/character/partials/save-row.hbs",
  "actor/character/partials/class-row.hbs",
  "actor/character/partials/item-row.hbs",
  "actor/character/partials/encumbrance-gauge.hbs",
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
}

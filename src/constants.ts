export const SYSTEM_ID = "adnd2e";

/** Absolute path to a bundled Handlebars template, e.g. `TEMPLATE_PATH("actor", "character.hbs")`. */
export function TEMPLATE_PATH(...segments: string[]): string {
  return `systems/${SYSTEM_ID}/templates/${segments.join("/")}`;
}

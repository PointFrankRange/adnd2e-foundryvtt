// Foundry glue (dev-world verified, not unit-tested): regroups the system's rows in
// the Configure Settings panel into collapsible Core / Optional sections.
import { SYSTEM_ID } from "../constants";
import { SETTING_SECTIONS } from "./sections";

const SECTION_CLASS = "adnd2e-settings-section";

export function registerSettingsSections(): void {
  Hooks.on("renderSettingsConfig", (_app: unknown, html: unknown) => {
    const root = html instanceof HTMLElement ? html : (html as { 0?: HTMLElement })[0];
    if (!root || root.querySelector(`.${SECTION_CLASS}`)) return; // already grouped this render
    const rowFor = (key: string): HTMLElement | null =>
      root.querySelector<HTMLElement>(`[name="${SYSTEM_ID}.${key}"]`)?.closest<HTMLElement>(".form-group") ?? null;
    for (const section of SETTING_SECTIONS) {
      const rows = section.keys.map(rowFor).filter((r): r is HTMLElement => r !== null);
      if (rows.length === 0) continue;
      const details = document.createElement("details");
      details.className = `${SECTION_CLASS} ${SECTION_CLASS}--${section.kind}`;
      details.open = section.kind === "core";
      const summary = document.createElement("summary");
      const title = document.createElement("span");
      title.textContent = game.i18n!.localize(`ADND2E.settings.sections.${section.id}`);
      const badge = document.createElement("span");
      badge.className = "adnd2e-settings-badge";
      badge.textContent = game.i18n!.localize(`ADND2E.settings.sections.kind.${section.kind}`);
      summary.append(title, badge);
      details.append(summary);
      rows[0]!.before(details);
      for (const row of rows) details.append(row);
    }
  });
}

import { SYSTEM_ID } from "../constants";

interface ModifiableCombatant {
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
  initiative: number | null;
  id: string;
  combat: { rollInitiative(ids: string[]): Promise<unknown> } | null;
}

/** Prompts for a new situational initiative modifier and stores it on the
 *  combatant (read by src/documents/combatant.ts's _getInitiativeFormula,
 *  unchanged by this task). If the combatant has already rolled this round,
 *  immediately re-rolls so the change is visibly reflected without requiring
 *  a separate manual reroll. */
export async function promptInitiativeModifier(combatant: ModifiableCombatant): Promise<void> {
  const current = Number(combatant.getFlag(SYSTEM_ID, "initiativeModifier") ?? 0);
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n!.localize("ADND2E.combat.initiativeModifier.title") },
    content: `<p>${game.i18n!.localize("ADND2E.combat.initiativeModifier.hint")}</p>
      <input type="number" name="modifier" value="${current}" step="1" autofocus>`,
    ok: {
      label: game.i18n!.localize("ADND2E.combat.initiativeModifier.set"),
      callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
        const input = button.form?.elements.namedItem("modifier");
        return input instanceof HTMLInputElement ? input.valueAsNumber : NaN;
      },
    },
  });
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  await combatant.setFlag(SYSTEM_ID, "initiativeModifier", value);
  if (typeof combatant.initiative === "number" && combatant.combat) {
    await combatant.combat.rollInitiative([combatant.id]);
  }
}

// Sub-project 14 Plan B: a small DialogV2 prompt for Table 20 recovery —
// picking an activity type and a number of hours. Mirrors the existing
// free-magick-dialog.ts DialogV2.prompt pattern.
import type { ChannellerActivity } from "../../core/magic/channellers";

const ACTIVITIES: readonly ChannellerActivity[] = ["hardExertion", "walkingRiding", "sittingResting", "sleeping"];

/** Prompts for an activity type and a whole number of hours. Returns null if
 *  cancelled or the hours field isn't a positive integer. */
export async function promptRecoverChannelling(): Promise<{ activity: ChannellerActivity; hours: number } | null> {
  const options = ACTIVITIES.map(
    (a) => `<option value="${a}">${game.i18n!.localize(`ADND2E.sheet.spells.channellingActivity.${a}`)}</option>`,
  ).join("");
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n!.localize("ADND2E.sheet.spells.channellingRecoverTitle") },
    content: `<div class="form-group">
        <label>${game.i18n!.localize("ADND2E.sheet.spells.channellingActivityLabel")}</label>
        <select name="activity" autofocus>${options}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n!.localize("ADND2E.sheet.spells.channellingHoursLabel")}</label>
        <input type="number" name="hours" value="1" min="1" step="1">
      </div>`,
    ok: {
      label: game.i18n!.localize("ADND2E.sheet.spells.channellingRecoverTitle"),
      callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
        const activitySelect = button.form?.elements.namedItem("activity");
        const hoursInput = button.form?.elements.namedItem("hours");
        const activity = activitySelect instanceof HTMLSelectElement ? activitySelect.value : null;
        const hours = hoursInput instanceof HTMLInputElement ? Number(hoursInput.value) : null;
        if (!activity || !hours || !Number.isInteger(hours) || hours < 1) return null;
        return { activity: activity as ChannellerActivity, hours };
      },
    },
  });
  return (value as { activity: ChannellerActivity; hours: number } | null) ?? null;
}

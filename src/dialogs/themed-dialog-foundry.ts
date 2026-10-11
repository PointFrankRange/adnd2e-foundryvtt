// Themed DialogV2 wrappers (#150). Foundry-coupled; the only place in src/ allowed to call DialogV2.prompt/confirm
// directly (tests/dialogs/dialog-theme-guard.test.ts enforces that). They add the system dialog classes so
// styles/dialog/_dialog.scss themes our own dialogs and nothing else.
import { withDialogTheme } from "./themed-dialog";

/** DialogV2.prompt with the system dialog theme. Same signature and result as the core call. */
export const themedPrompt: typeof foundry.applications.api.DialogV2.prompt = (config) =>
  foundry.applications.api.DialogV2.prompt(withDialogTheme(config as never) as never);

/** DialogV2.confirm with the system dialog theme. Same signature and result as the core call. */
export const themedConfirm: typeof foundry.applications.api.DialogV2.confirm = (config) =>
  foundry.applications.api.DialogV2.confirm(withDialogTheme(config as never) as never);

// Pure options builder for the system's themed DialogV2 dialogs (#150). No Foundry imports — the Foundry-coupled
// wrappers live in src/dialogs/themed-dialog-foundry.ts. The window classes below are what styles/dialog/_dialog.scss
// (and the shared theme tokens) key on; only our own dialogs ever get them.

export const DIALOG_CLASSES = ["adnd2e", "adnd2e-dialog"] as const;

/** The dialog options with the system dialog classes added after any classes the caller set. Pure: never mutates. */
export function withDialogTheme<T extends object>(options: T & { classes?: readonly string[] }): T & { classes: string[] } {
  const own = options.classes ?? [];
  return { ...options, classes: [...own, ...DIALOG_CLASSES.filter((c) => !own.includes(c))] };
}

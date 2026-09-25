// The actor update that keeps spellcasting state consistent when an owned spell
// Item is deleted from the sheet: drops it from the wizard spellbook and both
// memorized lists, and clears an in-progress cast of it (SP9). Without this a
// deleted spell left an orphaned memorized entry, a stale spellbook id, or a cast
// that could never complete. Pure — returns only the keys that actually change.

interface MemorizedEntry {
  spellItemId: string;
  spellLevel: number;
  expended: boolean;
}

export interface SpellcastingSource {
  spellcasting: {
    wizard: { spellbookItemIds: readonly string[]; memorized: readonly MemorizedEntry[] };
    priest: { memorized: readonly MemorizedEntry[] };
  };
  options?: { spellsAndMagic?: { casting?: { spellItemId: string } | null } };
}

export function spellDeletionUpdate(system: SpellcastingSource, spellItemId: string): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  const { wizard, priest } = system.spellcasting;
  if (wizard.spellbookItemIds.includes(spellItemId)) {
    update["system.spellcasting.wizard.spellbookItemIds"] = wizard.spellbookItemIds.filter((id) => id !== spellItemId);
  }
  for (const [key, list] of [["wizard", wizard.memorized], ["priest", priest.memorized]] as const) {
    if (list.some((e) => e.spellItemId === spellItemId)) {
      update[`system.spellcasting.${key}.memorized`] = list.filter((e) => e.spellItemId !== spellItemId);
    }
  }
  if (system.options?.spellsAndMagic?.casting?.spellItemId === spellItemId) {
    update["system.options.spellsAndMagic.casting"] = null;
  }
  return update;
}

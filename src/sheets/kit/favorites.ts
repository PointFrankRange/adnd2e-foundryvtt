// Sheet favorites (sheet redesign R1). A per-actor list of pinned items, spells
// and thief skills, stored as `flags.adnd2e.favorites` = `{ kind, id }[]`, and the
// display rows the Favorites panel renders with their one-click action. Pure.

export type FavoriteKind = "item" | "spell" | "thiefSkill";
export interface FavoriteEntry {
  kind: FavoriteKind;
  id: string;
}

const KINDS: readonly FavoriteKind[] = ["item", "spell", "thiefSkill"];

/** The stored flag, cleaned: valid `{kind, id}` entries only, first occurrence wins. */
export function normalizeFavorites(raw: unknown): FavoriteEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: FavoriteEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { kind, id } = entry as Record<string, unknown>;
    if (typeof id !== "string" || id === "" || !KINDS.includes(kind as FavoriteKind)) continue;
    if (!isFavorite(out, kind as FavoriteKind, id)) out.push({ kind: kind as FavoriteKind, id });
  }
  return out;
}

export function isFavorite(list: readonly FavoriteEntry[], kind: FavoriteKind, id: string): boolean {
  return list.some((e) => e.kind === kind && e.id === id);
}

/** Adds the entry if absent, removes it if present. */
export function toggleFavoriteList(list: readonly FavoriteEntry[], entry: FavoriteEntry): FavoriteEntry[] {
  return isFavorite(list, entry.kind, entry.id)
    ? list.filter((e) => !(e.kind === entry.kind && e.id === entry.id))
    : [...list, { kind: entry.kind, id: entry.id }];
}

export interface FavoriteSources {
  items: readonly { id: string; name: string; img: string; type: string; equipped: boolean }[];
  spells: readonly { id: string; name: string; img: string; canCast: boolean }[];
  thiefSkills: readonly { skill: string; label: string; effective: number; usable: boolean }[];
}

export interface FavoriteRow {
  kind: FavoriteKind;
  id: string;
  name: string;
  img: string;
  /** true when `name` is an i18n key (thief skills) */
  nameIsKey: boolean;
  detail: string;
  /** the sheet action this row's button triggers, or null when it can't be used now */
  action: "rollAttack" | "castSpell" | "rollThiefSkill" | "editItem" | null;
  /** dataset for the action button: `data-item-id` (items, spells) or `data-skill` (thief skills) */
  itemId: string | null;
  skill: string | null;
}

/** One row per favorite whose target still exists, in list order. */
export function buildFavoriteRows(list: readonly FavoriteEntry[], sources: FavoriteSources): FavoriteRow[] {
  const rows: FavoriteRow[] = [];
  for (const fav of list) {
    if (fav.kind === "item") {
      const it = sources.items.find((i) => i.id === fav.id);
      if (!it) continue;
      rows.push({
        kind: "item", id: it.id, name: it.name, img: it.img, nameIsKey: false, detail: "",
        action: it.type === "weapon" && it.equipped ? "rollAttack" : "editItem",
        itemId: it.id, skill: null,
      });
    } else if (fav.kind === "spell") {
      const sp = sources.spells.find((s) => s.id === fav.id);
      if (!sp) continue;
      rows.push({
        kind: "spell", id: sp.id, name: sp.name, img: sp.img, nameIsKey: false, detail: "",
        action: sp.canCast ? "castSpell" : null, itemId: sp.id, skill: null,
      });
    } else {
      const t = sources.thiefSkills.find((s) => s.skill === fav.id);
      if (!t) continue;
      rows.push({
        kind: "thiefSkill", id: t.skill, name: t.label, img: "", nameIsKey: true, detail: `${t.effective}%`,
        action: t.usable ? "rollThiefSkill" : null, itemId: null, skill: t.skill,
      });
    }
  }
  return rows;
}

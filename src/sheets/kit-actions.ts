// Sheet-kit action glue shared by the PC and Character NPC sheets (sheet redesign R2).
// Foundry-coupled (reads/writes actor flags) — verified in the dev world.
import { SYSTEM_ID } from "../constants";
import { normalizeFavorites, toggleFavoriteList, type FavoriteKind } from "./kit/favorites";

/** ★ toggle: owner-only; `data-kind` + `data-id` on the clicked button. */
export async function toggleFavoriteFlag(document: unknown, target: HTMLElement): Promise<void> {
  const actor = document as {
    isOwner: boolean;
    getFlag(scope: string, key: string): unknown;
    setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
  };
  const kind = target.dataset.kind as FavoriteKind | undefined;
  const id = target.dataset.id;
  if (!actor.isOwner || !kind || !id) return;
  const current = normalizeFavorites(actor.getFlag(SYSTEM_ID, "favorites"));
  await actor.setFlag(SYSTEM_ID, "favorites", toggleFavoriteList(current, { kind, id }));
}

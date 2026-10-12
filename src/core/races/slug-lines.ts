import { isRaceSlug } from "./slug";

/**
 * Parse a one-race-slug-per-line textarea (a kit's qualifying races). Blank lines are
 * dropped; any non-slug line (e.g. "Lizard Man") makes the whole parse fail (null) so a
 * typo can never be saved as a race that silently never qualifies.
 */
export function parseRaceSlugLines(text: string): string[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.every((l) => isRaceSlug(l)) ? lines : null;
}

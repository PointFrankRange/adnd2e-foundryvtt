const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A race id: lowercase words joined by single hyphens, 1-40 characters. */
export function isRaceSlug(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 40 && SLUG.test(value);
}

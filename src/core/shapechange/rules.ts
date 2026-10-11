// Druid shapechanging (SP16, #84), pure and Foundry-free. Source: The Complete Druid's Handbook (PHBR13) Druid
// Characters ch. and branch entries; PH p.37 baseline. Mechanical values only. The system ships no animal stat blocks:
// a form is a GM-authored Monster NPC tagged with `details.shapechange`, snapshotted onto the druid at shift time.

export const SHAPECHANGE_CATEGORIES = ["reptile", "bird", "mammal"] as const;
export type ShapechangeCategory = (typeof SHAPECHANGE_CATEGORIES)[number];

export const SHAPECHANGE_HABITATS = [
  "desert", "forest", "mountains", "plains", "swamp", "arctic", "jungle", "ocean", "underground",
] as const;

export interface ShapechangeSpec {
  minLevel: number;
  /** shifts per day */
  uses: number;
  categories: ShapechangeCategory[];
  /** each category (reptile, bird, mammal) may be used once per day */
  oncePerCategory: boolean;
  /** empty = no habitat restriction */
  habitats: string[];
  allowGiant: boolean;
}

/** The Player's Handbook rule: 3 a day from 7th level, each category once, any habitat, no giant forms. */
export const BASE_SHAPECHANGE_SPEC: Readonly<ShapechangeSpec> = {
  minLevel: 7,
  uses: 3,
  categories: [...SHAPECHANGE_CATEGORIES],
  oncePerCategory: true,
  habitats: [],
  allowGiant: false,
};

export interface PowerLike {
  id: string;
  uses: number;
  per: string;
  params: { key: string; value: string }[];
}

const csv = (value: string): string[] => value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/** The kit's `shapechange` power read leniently: anything malformed or unknown falls back to the base value. */
export function resolveShapechangeSpec(power: PowerLike | null | undefined): ShapechangeSpec {
  const spec: ShapechangeSpec = { ...BASE_SHAPECHANGE_SPEC, categories: [...BASE_SHAPECHANGE_SPEC.categories], habitats: [] };
  if (!power) return spec;
  if (power.per === "day" && power.uses > 0) spec.uses = power.uses;
  const param = (key: string) => power.params.find((p) => p.key === key)?.value;
  const minLevel = Number(param("minLevel"));
  if (Number.isInteger(minLevel) && minLevel > 0) spec.minLevel = minLevel;
  const categories = csv(param("categories") ?? "").filter((c): c is ShapechangeCategory =>
    (SHAPECHANGE_CATEGORIES as readonly string[]).includes(c));
  if (categories.length) spec.categories = categories;
  const habitats = csv(param("habitats") ?? "").filter((h) => (SHAPECHANGE_HABITATS as readonly string[]).includes(h));
  if (habitats.length) spec.habitats = habitats;
  if (param("oncePerCategory") === "false") spec.oncePerCategory = false;
  if (param("giant") === "true") spec.allowGiant = true;
  return spec;
}

export function shapechangeAvailable(druidLevel: number, spec: ShapechangeSpec): boolean {
  return druidLevel >= spec.minLevel;
}

export interface FormTags {
  category: ShapechangeCategory | "";
  habitats: readonly string[];
  giant: boolean;
}

export function formEligible(form: FormTags, spec: ShapechangeSpec): boolean {
  if (form.category === "" || !spec.categories.includes(form.category)) return false;
  if (form.giant && !spec.allowGiant) return false;
  if (spec.habitats.length > 0 && !form.habitats.some((h) => spec.habitats.includes(h))) return false;
  return true;
}

export interface ShapechangeState {
  usedToday: number;
  categoriesUsed: readonly string[];
}

export function usesLeft(state: ShapechangeState, spec: ShapechangeSpec): number {
  return Math.max(0, spec.uses - state.usedToday);
}

export type ShiftBlock = "noUsesLeft" | "categoryUsed" | "notEligible";

export function canShift(
  state: ShapechangeState,
  spec: ShapechangeSpec,
  form: FormTags,
): { ok: true } | { ok: false; reason: ShiftBlock } {
  if (!formEligible(form, spec)) return { ok: false, reason: "notEligible" };
  if (usesLeft(state, spec) === 0) return { ok: false, reason: "noUsesLeft" };
  if (spec.oncePerCategory && form.category !== "" && state.categoriesUsed.includes(form.category)) {
    return { ok: false, reason: "categoryUsed" };
  }
  return { ok: true };
}

export function afterShift(state: ShapechangeState, category: ShapechangeCategory): ShapechangeState {
  return {
    usedToday: state.usedToday + 1,
    categoriesUsed: state.categoriesUsed.includes(category) ? [...state.categoriesUsed] : [...state.categoriesUsed, category],
  };
}

export function afterNewDay(): ShapechangeState {
  return { usedToday: 0, categoriesUsed: [] };
}

/** Assuming a new form heals 1d6 x 10% of the damage taken, fractions rounded down (PHBR13 p.7's worked example: 15, 3 -> 4). */
export function healOnShift(damageTaken: number, d6: number): number {
  return Math.max(0, Math.floor((damageTaken * d6 * 10) / 100));
}

export interface FormAttack {
  name: string;
  count: number;
  damage: string;
  type: string;
}

export interface FormMovement {
  land: number;
  burrow: number;
  climb: number;
  fly: number;
  swim: number;
  flyManeuverability: string;
}

export interface FormSnapshot {
  name: string;
  img: string;
  category: ShapechangeCategory;
  ac: number;
  movement: FormMovement;
  attacks: FormAttack[];
}

export interface FormSource {
  name: string;
  img: string;
  system: {
    attributes: { ac: { value: number }; movement: Partial<FormMovement> };
    attacks: Partial<FormAttack>[];
    details: { shapechange: { category: string } };
  };
}

/** The stat block as copied onto the druid at shift time; null when the source is not tagged as a form. */
export function snapshotForm(source: FormSource): FormSnapshot | null {
  const category = source.system.details.shapechange.category;
  if (!(SHAPECHANGE_CATEGORIES as readonly string[]).includes(category)) return null;
  const m = source.system.attributes.movement;
  return {
    name: source.name,
    img: source.img,
    category: category as ShapechangeCategory,
    ac: source.system.attributes.ac.value,
    movement: {
      land: m.land ?? 0, burrow: m.burrow ?? 0, climb: m.climb ?? 0, fly: m.fly ?? 0, swim: m.swim ?? 0,
      flyManeuverability: m.flyManeuverability ?? "",
    },
    attacks: source.system.attacks.map((a) => ({
      name: a.name ?? "", count: a.count ?? 1, damage: a.damage ?? "", type: a.type ?? "melee",
    })),
  };
}

/** While shifted every AC context is the form's AC (no Dexterity, rear-attack or shield variation). */
export function formArmorClass(snapshot: Pick<FormSnapshot, "ac">): {
  normal: number; rearAttack: number; surprised: number; shieldless: number;
} {
  return { normal: snapshot.ac, rearAttack: snapshot.ac, surprised: snapshot.ac, shieldless: snapshot.ac };
}

# Item sheet layouts: gear and spells (#110, #111) — design

Date: 2026-10-09 · Issues: #110 (per-type layouts, themed spell sheet), #111 (label maps, prose descriptions) · Branch: `feat/item-sheet-layouts`

## Background

All fourteen Item types share one generic sheet (`src/sheets/raw-field-sheet.ts`, mounted by `src/sheets/item-sheet.ts`). It walks the type's `system` schema, renders one input per field, and groups the rows into kit panels (`groupFieldRows`: header, description, a "Details" panel, then one panel per schema group). Nullable fields, one-per-line lists, choice dropdowns, multi-select checkbox lists and JSON fallbacks are already handled and round-trip through `_processFormData`.

What is missing: no per-type layout, no themed spell sheet (#110), and raw enum values such as `chain-mail` and `piercing-slashing` are shown with no label maps, with no item prose in the actor-sheet row summaries (#111). The weapon/armor row summary in `templates/actor/pc/partials/pc-item-table.hbs` prints `weapon.category`, `weapon.damageType` and `armor.armorType` raw.

## Decisions (made with the user)

- **Scope:** five types get designed layouts: weapon, armor, equipment, ammo, spell. The nine data-definition types (class, race, kit, trait, power, classFeature, condition, weaponProficiency, nonweaponProficiency) keep the generic grouped sheet.
- **#111 is included:** label maps and prose descriptions ship in this work.
- **Mechanism:** a declarative layout spec per type rendered by the existing engine, with every unlisted schema field falling into an automatic "Other" panel. No hand-written per-type templates.
- **Spell sheet:** a spell-card header (level badge, caster class, school and sphere chips, V/S/M pills) over the casting panels, with the prose description directly under the casting panel.

## Design

### 1. Layout specs and `applyLayout` (new pure module `src/sheets/item-layouts/`)

No Foundry imports; added to the coverage gate in `vitest.config.ts`.

```ts
interface LayoutPanel { titleKey: string; paths: string[]; columns?: 1 | 2 | 3 }
interface ItemLayout {
  strip?: string[];                 // field paths shown in the compact stat strip under the title
  panels: LayoutPanel[];            // ordered
  descriptionAfter?: string;        // index/title key of the panel the description is placed under (default: header)
}
export const ITEM_LAYOUTS: Partial<Record<ItemSubtype, ItemLayout>>;
export function applyLayout(rows: FieldRow[], layout: ItemLayout): { strip: FieldRow[]; panels: PanelView[]; ... };
```

- Paths are the sheet's existing dot-paths (`system.damageVsSM`, `system.range.short`, ...). A group heading or a nullable-group toggle row travels with its children; a path may name a whole `SchemaField` group (e.g. `system.range`) to place the group and all its child rows together.
- Rows keep their existing indent, `data-*` attributes and `kind`, so every existing parser (nullable select, `data-lines`, multi-select, JSON) keeps working unchanged.
- Any row not claimed by a strip or panel is collected into a trailing panel titled "Other" (`ADND2E.sheets.layout.other`). A path in a layout that matches no row is ignored at render time (and is a test failure, see Testing). Empty panels are omitted.
- `groupFieldRows` stays as the fallback and is also the source of the header (name/image) and description rows; `applyLayout` takes over only the system-field grouping for types that have a layout.

### 2. The five layouts

All paths are `system.<field>`; panel titles are new `ADND2E.sheets.layout.*` keys.

- **Weapon:** strip `category`, `damageVsSM`, `damageVsL`, `damageType`, `speedFactor`. Panels: Combat (`size`, `handsRequired`, `rateOfFire`, `materialToHit`, `magicBonus`), Range (`range` group), Proficiency & Mastery (`proficiencyGroup`, `baseWeaponName`, `styleGroup`, `specialistWeaponClass`, plus the mastery fields not named here fall to Other), Ammunition (`ammoType`, `selectedAmmoId`), Physical.
- **Armor:** strip `baseAc`, `armorType`, `isShield`. Panels: Protection (`shieldAcBonus`, `magicBonus`), Penalties (`movementPenalty`, `checkPenalty`), Physical.
- **Equipment:** panels Details (`category`, `consumable`, `magicBonus`), Charges (`charges` group), Container (`container`, `capacity`, `contentsWeightMultiplier`), Physical.
- **Ammo:** strip `ammoType`, `damageVsSM`, `damageVsL`, `damageType`. Panels: Physical.
- **Physical** (shared by weapon, armor, equipment, ammo): `quantity`, `weight`, `cost` group, `location`, `identified`, `equipped`.
- **Spell:** see §3.

The implementation plan reads each model first and moves any field into a better panel; the invariant is only that every schema field appears exactly once (a claimed path or the Other panel).

### 3. The themed spell sheet

- Strip (the spell-card header): `level` (badge), `casterClass`, then `schools` and `spheres` (the existing multi-select checkbox lists, shown as chips of the current selection), then `components.v`, `components.s`, `components.m` rendered as V / S / M pills.
- The pills are the real checkboxes, styled so a checked box lights its pill; chips and badge are CSS over the existing inputs. There is no duplicate state and no new parser.
- Panels: Casting (`range`, `duration`, `castingTime`, `areaOfEffect`, `savingThrow`), Components (`materialComponent`), Reversible (`reversible`, `isReversedForm`), Automation (`automation` group). The description panel is placed directly under Casting.
- Styling lives in `styles/kit/_kit.scss` using the existing kit tokens, scoped to the item sheet.

### 4. Label maps (#111)

- New `CONFIG.ADND2E.armorTypes` (13 types) and `CONFIG.ADND2E.weaponDamageTypes` (slashing, piercing, bludgeoning, piercing-slashing, piercing-bludgeoning; the existing spell `damageTypes` map does not cover the combined ones), with `ADND2E.*` en.json strings. If `weaponCategories` or `weaponSizes` maps do not already exist, add them too.
- `toChoiceRows` in the sheet engine looks up a label for a choice from the config maps (by field name) when one exists, falling back to the raw value, so every weapon/armor/ammo select shows a label.
- The actor-sheet row summaries (`pc-item-table.hbs`, via the context builder) show the labels for category, damage type and armor type.

### 5. Prose descriptions in the actor-sheet row summaries (#111)

- The expanded `.kit-summary` of an inventory row shows the item's description under its stats, passed through Foundry's text enrichment so it renders as safe sanitized HTML and not raw markup. An empty description shows nothing.
- The context builder adds an `description` field to each inventory row; enrichment happens in the sheet's `_prepareContext` (async, Foundry-coupled), the plain-text/HTML shaping stays in the pure context code.

### 6. Out of scope

Layouts for the other nine types; the item Effects UI (#146, the next item); any schema, setting or migration change; changing how values save (the engine's `_processFormData` is untouched).

## Testing

- Unit tests (`tests/sheets/item-layouts/`): `applyLayout` panel and strip placement and order, group-with-children placement, the automatic Other panel, empty-panel omission, a row claimed by two panels placed once, and rows kept byte-for-byte (indent/attributes).
- Layout census (headless harness, real data models): every path in every `ITEM_LAYOUTS` spec exists in that type's schema, and every schema field is claimed or lands in Other, so a layout can never reference a missing field.
- Label-map tests: every `ARMOR_TYPES` and `DAMAGE_TYPES` value has a config entry and an en.json string (extend `tests/lang` and config tests).
- Template-binding/lang coverage for the new copy; row-summary context test for labels and description.
- Gates before the PR: `npm run lint`, `npm run typecheck` (incl. `tsconfig.core.json`), `npm run test:coverage` (100% statements).
- Manual dev-world checklist with stated prerequisites: each of the five types in edit mode (edit a value, close, reopen: it saved), a spell with schools/spheres/components set, a weapon with an ammo type, the inventory row summaries on a PC, a read-only view of an item the viewer does not own, and the same from a non-GM seat. Reset settings between checks.

## Risks

- The engine renders rows with indent-based grouping; `applyLayout` must move a group heading and its children as a unit or nullable-group toggles (`data-null-group`) break.
- Label lookup by field name couples the engine to config keys; fall back to the raw value so an unmapped field never renders blank.
- Description enrichment is async and must not run for items the viewer cannot observe; use the item's own permission-aware path.

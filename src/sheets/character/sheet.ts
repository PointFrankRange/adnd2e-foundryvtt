import { TEMPLATE_PATH } from "../../constants";
import { getChassis } from "../../core/classes/chassis";
import type { ClassId } from "../../core/types";
import { buildCharacterSheetContext } from "./context";
import type {
  ClassItemView,
  CharacterSheetInput,
  FeatureItemView,
  NwpView,
  PhysicalItemView,
  RaceItemView,
  SpellItemView,
  WeaponProfView,
} from "./context-types";
import { validateItemDrop } from "./drop-rules";

/* ---------------------------------------------------------------------------
 * Adnd2eCharacterSheet — the ApplicationV2 PC sheet shell (SP2 Task 5).
 *
 * Foundry-coupled, no unit tests (spec §9) — verified in a linked dev world at
 * Task 9. All rendering data is produced by the pure `buildCharacterSheetContext`
 * (Task 4); this class only reads the document, assembles the plain input, and
 * wires tabs / drop validation / action stubs.
 * ------------------------------------------------------------------------- */

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

// ActorSheetV2 extends DocumentSheetV2 directly (no HandlebarsApplicationMixin
// in v14.364 — verified in client/applications/sheets/actor-sheet.mjs), so the
// mixin is applied here, same as the SP1 stub over DocumentSheetV2. Collapse the
// mixin's `TBase & (new () => …)` intersection to a single constructor to dodge
// TS2510, then re-describe the members this class actually touches.
const Base = HandlebarsApplicationMixin(ActorSheetV2 as never) as unknown as new (
  ...args: never[]
) => {
  actor: Actor.Implementation;
  document: Actor.Implementation;
  isEditable: boolean;
  _prepareContext(options: unknown): Promise<Record<string, unknown>>;
  _preparePartContext(
    partId: string,
    context: Record<string, unknown>,
    options: unknown,
  ): Promise<Record<string, unknown>>;
  _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown>;
};

const T = (p: string): string => TEMPLATE_PATH("actor/character", p);

/* ---------- item -> *View mappers (mechanical field projection) ---------- */

interface RawItem {
  id: string;
  name: string;
  img: string;
  type: string;
  system: Record<string, unknown>;
}

function toClassView(it: RawItem): ClassItemView {
  const s = it.system as {
    chassisId: string;
    xp: number;
    level: number;
    canLevelUp: boolean;
    dualClassState: string | null;
    specialistSchool: string | null;
  };
  return {
    id: it.id,
    name: it.name,
    img: it.img,
    chassisId: s.chassisId,
    hitDie: getChassis(s.chassisId as ClassId).hitDie,
    xp: s.xp,
    level: s.level,
    canLevelUp: s.canLevelUp,
    dualClassState: s.dualClassState as ClassItemView["dualClassState"],
    specialistSchool: s.specialistSchool,
  };
}

function toRaceView(it: RawItem): RaceItemView {
  const s = it.system as {
    raceId: string;
    size: string;
    baseMovement: number;
    infravision: number;
    grantedFeatures: string[];
    bonusLanguages: string[];
  };
  return {
    id: it.id,
    name: it.name,
    img: it.img,
    raceId: s.raceId,
    size: s.size,
    baseMovement: s.baseMovement,
    infravision: s.infravision,
    grantedFeatures: [...(s.grantedFeatures ?? [])],
    bonusLanguages: [...(s.bonusLanguages ?? [])],
  };
}

function rangeToString(range: unknown): string | null {
  if (!range || typeof range !== "object") return null;
  const r = range as { short: number; medium: number; long: number };
  return `${r.short}/${r.medium}/${r.long}`;
}

function toPhysicalView(it: RawItem): PhysicalItemView {
  const s = it.system as Record<string, unknown>;
  const type = it.type as PhysicalItemView["type"];
  const view: PhysicalItemView = {
    id: it.id,
    name: it.name,
    img: it.img,
    type,
    quantity: Number(s.quantity ?? 0),
    weight: Number(s.weight ?? 0),
    totalWeight: Number(s.totalWeight ?? 0),
    location: String(s.location ?? ""),
    equipped: Boolean(s.equipped),
    identified: Boolean(s.identified),
    magicBonus: Number(s.magicBonus ?? 0),
    isContainer: type === "equipment" ? Boolean(s.container) : false,
    capacity: type === "equipment" ? ((s.capacity as number | null) ?? null) : null,
    contentsWeightMultiplier:
      type === "equipment" ? Number(s.contentsWeightMultiplier ?? 1) : 1,
  };
  if (type === "weapon") {
    view.weapon = {
      damageVsSM: (s.damageVsSM as string | null) ?? null,
      damageVsL: (s.damageVsL as string | null) ?? null,
      speedFactor: Number(s.speedFactor ?? 0),
      range: rangeToString(s.range),
    };
  }
  if (type === "armor") {
    view.armor = {
      baseAc: Number(s.baseAc ?? 10),
      isShield: Boolean(s.isShield),
      shieldAcBonus: Number(s.shieldAcBonus ?? 0),
    };
  }
  return view;
}

function toWeaponProfView(it: RawItem): WeaponProfView {
  const s = it.system as {
    weaponOrGroup: string;
    isGroup: boolean;
    slotsInvested: number;
    specialized: boolean;
  };
  return {
    id: it.id,
    name: it.name,
    weaponOrGroup: s.weaponOrGroup,
    isGroup: s.isGroup,
    slotsInvested: s.slotsInvested,
    specialized: s.specialized,
  };
}

function toNwpView(it: RawItem): NwpView {
  const s = it.system as {
    governingAbility: string;
    modifier: number;
    slotCost: number;
    slotsInvested: number;
    isRacial: boolean;
  };
  return {
    id: it.id,
    name: it.name,
    governingAbility: s.governingAbility,
    modifier: s.modifier,
    slotCost: s.slotCost,
    slotsInvested: s.slotsInvested,
    isRacial: s.isRacial,
    checkTarget: null, // buildSkills recomputes from the governing ability score
  };
}

function toSpellView(it: RawItem): SpellItemView {
  const s = it.system as {
    casterClass: string;
    level: number;
    schools: string[];
    spheres: string[];
    range: string;
    castingTime: string;
    savingThrow: string;
  };
  return {
    id: it.id,
    name: it.name,
    img: it.img,
    casterClass: s.casterClass,
    level: s.level,
    schools: [...(s.schools ?? [])],
    spheres: [...(s.spheres ?? [])],
    range: s.range,
    castingTime: s.castingTime,
    savingThrow: s.savingThrow,
    inSpellbook: true,
  };
}

function toFeatureView(it: RawItem): FeatureItemView {
  const s = it.system as {
    sourceType: string;
    activation: string;
    uses: { value: number; max: number; per: string } | null;
    description: string;
  };
  return {
    id: it.id,
    name: it.name,
    img: it.img,
    sourceType: s.sourceType,
    activation: s.activation,
    uses: s.uses ?? null,
    description: s.description ?? "",
  };
}

/* ------------------------------------------------------------------------- */

export class Adnd2eCharacterSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "actor", "character"],
    position: { width: 720, height: 800 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollHp: Adnd2eCharacterSheet.#onRollHp,
      takeAverageHp: Adnd2eCharacterSheet.#onTakeAverageHp,
      awardXp: Adnd2eCharacterSheet.#onAwardXp,
      toggleDualClass: Adnd2eCharacterSheet.#onToggleDualClass,
    },
  };

  static PARTS = {
    header: { template: T("header.hbs") },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    main: {
      template: T("main.hbs"),
      scrollable: [""],
      templates: [
        T("partials/ability-row.hbs"),
        T("partials/save-row.hbs"),
        T("partials/class-row.hbs"),
      ],
    },
    combat: { template: T("combat.hbs"), scrollable: [""] },
    inventory: { template: T("inventory.hbs"), scrollable: [""] },
    skills: { template: T("skills.hbs"), scrollable: [""] },
    spells: { template: T("spells.hbs"), scrollable: [""] },
    features: { template: T("features.hbs"), scrollable: [""] },
    biography: { template: T("biography.hbs"), scrollable: [""] },
  };

  static TABS = {
    primary: {
      initial: "main",
      labelPrefix: "ADND2E.sheet.tabs",
      tabs: [
        { id: "main", icon: "fa-solid fa-user" },
        { id: "combat", icon: "fa-solid fa-shield-halved" },
        { id: "inventory", icon: "fa-solid fa-box-open" },
        { id: "skills", icon: "fa-solid fa-hand-fist" },
        { id: "spells", icon: "fa-solid fa-wand-sparkles" },
        { id: "features", icon: "fa-solid fa-star" },
        { id: "biography", icon: "fa-solid fa-book" },
      ],
    },
  };

  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    context.adnd2e = buildCharacterSheetContext(this.#buildInput());
    context.editable = this.isEditable;
    context.alignments = (
      CONFIG as unknown as { ADND2E: { alignments: Record<string, string> } }
    ).ADND2E.alignments;
    return context;
  }

  override async _preparePartContext(
    partId: string,
    context: Record<string, unknown>,
    options: unknown,
  ): Promise<Record<string, unknown>> {
    const ctx = await super._preparePartContext(partId, context, options);
    const tabs = ctx.tabs as Record<string, unknown> | undefined;
    if (tabs && partId in tabs) ctx.tab = tabs[partId];
    return ctx;
  }

  #buildInput(): CharacterSheetInput {
    const actor = this.document as unknown as {
      name: string;
      img: string;
      _source: Record<string, unknown>;
      system: Record<string, unknown>;
      isOwner: boolean;
      items: Iterable<RawItem>;
    };
    const items = [...actor.items];
    const cfg = (CONFIG as unknown as { ADND2E: Record<string, Record<string, string>> }).ADND2E;

    const classItems: ClassItemView[] = [];
    let raceItem: RaceItemView | null = null;
    const physicalItems: PhysicalItemView[] = [];
    const weaponProfs: WeaponProfView[] = [];
    const nonweaponProfs: NwpView[] = [];
    const spellItems: SpellItemView[] = [];
    const featureItems: FeatureItemView[] = [];

    for (const it of items) {
      switch (it.type) {
        case "class":
          classItems.push(toClassView(it));
          break;
        case "race":
          raceItem ??= toRaceView(it);
          break;
        case "weapon":
        case "armor":
        case "equipment":
          physicalItems.push(toPhysicalView(it));
          break;
        case "weaponProficiency":
          weaponProfs.push(toWeaponProfView(it));
          break;
        case "nonweaponProficiency":
          nonweaponProfs.push(toNwpView(it));
          break;
        case "spell":
          spellItems.push(toSpellView(it));
          break;
        case "classFeature":
          featureItems.push(toFeatureView(it));
          break;
        default:
          break;
      }
    }

    return {
      name: actor.name,
      img: actor.img,
      source: actor._source,
      derived: actor.system as never,
      classItems,
      raceItem,
      physicalItems,
      proficiencyItems: { weapon: weaponProfs, nonweapon: nonweaponProfs },
      spellItems,
      featureItems,
      config: {
        abilities: cfg.abilities,
        saves: cfg.saves,
        alignments: cfg.alignments,
        encumbranceCategories: cfg.encumbranceCategories,
        classGroups: cfg.classGroups,
        schools: cfg.schools,
        spheres: cfg.spheres,
      },
      perms: {
        isGM: (game as unknown as { user: { isGM: boolean } }).user.isGM,
        isOwner: actor.isOwner,
        editable: this.isEditable,
      },
    };
  }

  override async _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown> {
    const existing = [
      ...(this.document as unknown as { items: Iterable<{ type: string; system: { chassisId?: string | null } }> })
        .items,
    ];
    const dropped = item as unknown as { type: string; system: { chassisId?: string | null } };
    const verdict = validateItemDrop({
      dropType: dropped.type,
      dropChassisId: dropped.system?.chassisId ?? null,
      hasRace: existing.some((i) => i.type === "race"),
      existingChassisIds: existing
        .filter((i) => i.type === "class")
        .map((i) => i.system.chassisId ?? "")
        .filter(Boolean),
    });
    if (!verdict.ok) {
      ui.notifications?.warn(game.i18n!.localize(verdict.reason!));
      return null;
    }
    return super._onDropItem(event, item);
  }

  // Interaction handlers land in Task 8 (hp-roll.ts + Award XP + dual-class).
  static async #onRollHp(this: Adnd2eCharacterSheet): Promise<void> {
    /* Task 8 */
  }

  static async #onTakeAverageHp(this: Adnd2eCharacterSheet): Promise<void> {
    /* Task 8 */
  }

  static async #onAwardXp(this: Adnd2eCharacterSheet): Promise<void> {
    /* Task 8 */
  }

  static async #onToggleDualClass(this: Adnd2eCharacterSheet): Promise<void> {
    /* Task 8 */
  }
}

// Pin the class name so DocumentSheetConfig.registerSheet's id (adnd2e.<name>)
// survives minification.
Object.defineProperty(Adnd2eCharacterSheet, "name", {
  value: "Adnd2eCharacterSheet",
  configurable: true,
});

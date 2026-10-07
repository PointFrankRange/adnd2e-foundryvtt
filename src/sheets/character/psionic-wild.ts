import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import { isHalved, lookupWild, testWildTalent as rollWildTest, wildTalentChance, type DireOutcome, type WildResult } from "../../core/psionics/wild";
import { getOptionalRules } from "../../settings";
import { info, warn, type PsionicItem } from "./psionic-actions";

/* SP15 Plan D - wild talents: the one-time test, the Table 12/13 power grant, the dire
 * consequences and the GM reset (PHBR5 pp.18-21). Foundry glue only; the rules live in
 * src/core/psionics/wild.ts. Every write targets the acting user's own actor, so a non-GM
 * owner can test, receive powers and apply a dire result. Every Foundry dependency is
 * injectable for tests. */

const MAX_APPLIED_IDS = 50;
const ABILITY_KEYS = ["wis", "int", "con"] as const;

export interface WildActor {
  uuid: string;
  name: string;
  img: string;
  items: Iterable<PsionicItem>;
  system: {
    abilities: Record<string, { score: number }>;
    psionics: { level: number; wild?: boolean };
    wildTalent: { tested: boolean; found: boolean; levelAtDiscovery: number };
    saves?: Record<string, { target: number; rollModifier: number }>;
  };
  /** The authored (unprepared) data: the BASE ability scores live here */
  _source?: { system?: { abilities?: Record<string, { score?: number }> } };
  isOwner?: boolean;
  getFlag?(scope: string, key: string): unknown;
  update(data: Record<string, unknown>): Promise<unknown>;
  createEmbeddedDocuments(type: string, docs: Record<string, unknown>[]): Promise<unknown>;
}

/** A power as the pack holds it (a plain object ready to embed). */
export interface PackPower {
  name: string;
  type: string;
  system: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ChoiceOption {
  name: string;
  discipline: string;
  kind: string;
}

/** The dire consequence stored on the card: what was lost and whether Apply ran. */
export interface WildDireFlag {
  ability: "wis" | "int" | "con" | "all";
  points: number | "all";
  applied: boolean;
}

/** The data carried in `flags.adnd2e.wildTalent` on a wild-talent chat card. */
export interface WildFlag {
  id: string;
  actorUuid: string;
  dire: WildDireFlag | null;
}

export interface WildDeps {
  roll100: () => Promise<number>;
  rollD6: () => Promise<number>;
  rollSave: (actor: WildActor, category: "ppd", opts: { penalty: number }) => Promise<boolean>;
  chooseDialog: (options: ChoiceOption[]) => Promise<string | null>;
  readPack: (pack: string) => Promise<PackPower[]>;
  settingOn: () => boolean;
}

export interface ApplyDeps {
  confirm: (title: string, content: string) => Promise<boolean>;
  userIsGM: () => boolean;
  getFlag: (messageId: string) => WildFlag | undefined;
  getActor: (uuid: string) => WildActor | null;
}

const rollTotal = async (formula: string): Promise<number> => Number((await new Roll(formula).evaluate()).total);

const defaultDeps = (): WildDeps => ({
  roll100: () => rollTotal("1d100"),
  rollD6: () => rollTotal("1d6"),
  rollSave: async (actor, category, opts) => (await import("./combat-rolls")).rollSave(actor as never, category, opts),
  chooseDialog: defaultChooseDialog,
  readPack: defaultReadPack,
  settingOn: () => getOptionalRules().wildTalents,
});

const defaultApplyDeps = (): ApplyDeps => ({
  confirm: async (title, content) =>
    Boolean(await foundry.applications.api.DialogV2.confirm({ window: { title }, content: `<p>${content}</p>` })),
  userIsGM: () => Boolean(game.user?.isGM),
  getFlag: (messageId) => (game.messages?.get(messageId) as { getFlag(s: string, k: string): unknown } | undefined)?.getFlag(SYSTEM_ID, "wildTalent") as WildFlag | undefined,
  getActor: (uuid) => foundry.utils.fromUuidSync(uuid) as unknown as WildActor | null,
});

async function defaultReadPack(pack: string): Promise<PackPower[]> {
  const collection = game.packs?.get(`${SYSTEM_ID}.${pack}`) as unknown as { getDocuments(): Promise<{ toObject(): Record<string, unknown> }[]> } | undefined;
  const docs = (await collection?.getDocuments()) ?? [];
  return docs.map((d) => d.toObject() as unknown as PackPower); // _id/_key are stripped when the power is granted
}

/** Asks the owner to pick one power; null = the dialog was cancelled. */
async function defaultChooseDialog(options: ChoiceOption[]): Promise<string | null> {
  const i18n = game.i18n!;
  const items = options
    .map((o) => `<option value="${foundry.utils.escapeHTML(o.name)}">${foundry.utils.escapeHTML(o.name)} (${i18n.localize(`ADND2E.sheet.psionics.discipline.${o.discipline}`)}, ${i18n.localize(`ADND2E.sheet.psionics.kind.${o.kind}`)})</option>`)
    .join("");
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title: i18n.localize("ADND2E.sheet.wildTalent.chooseTitle") },
    content: `<p>${i18n.localize("ADND2E.sheet.wildTalent.chooseHint")}</p><select name="power" autofocus>${items}</select>`,
    ok: {
      label: i18n.localize("ADND2E.sheet.wildTalent.choose"),
      callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
        const select = button.form?.elements.namedItem("power");
        return select instanceof HTMLSelectElement ? select.value : null;
      },
    },
  });
  return typeof value === "string" ? value : null;
}

const itemsOfType = (actor: WildActor, type: string): PsionicItem[] => [...actor.items].filter((i) => i.type === type);

/** The character's highest class level (0 with no class item). */
export function highestClassLevel(actor: WildActor): number {
  return itemsOfType(actor, "class").reduce((max, c) => Math.max(max, Number(c.system.level ?? 0)), 0);
}

/** Per-source parts of the chance (before halving), via the pure formula. */
function chanceParts(i: { wis: number; con: number; int: number; level: number }): { wis: number; con: number; int: number; level: number } {
  const part = (over: Partial<{ wis: number; con: number; int: number; level: number }>): number => wildTalentChance({ wis: 0, con: 0, int: 0, level: 0, ...over, halved: false }) - 1;
  return { wis: part({ wis: i.wis }), con: part({ con: i.con }), int: part({ int: i.int }), level: part({ level: i.level }) };
}

/* ---------------------------------------------------------------------------
 * Power determination (Tables 12 and 13).
 * ------------------------------------------------------------------------- */

interface Grant {
  deps: WildDeps;
  pack: PackPower[];
  /** names held or already granted in this test (case-sensitive) */
  taken: Set<string>;
  granted: PackPower[];
}

/** Grants one named power and, recursively, its not-yet-held prerequisites. */
function grant(g: Grant, name: string): void {
  if (g.taken.has(name)) return;
  const power = g.pack.find((p) => p.name === name);
  if (!power) return;
  g.taken.add(name);
  g.granted.push(power);
  for (const prerequisite of (power.system.prerequisites as string[] | undefined) ?? []) grant(g, prerequisite);
}

/** One owner pick from the eligible powers (not held, not yet granted); a cancelled dialog or no eligible power skips it. */
async function pick(g: Grant, eligible: (p: PackPower) => boolean): Promise<void> {
  const options = g.pack
    .filter((p) => !g.taken.has(p.name) && eligible(p))
    .map((p) => ({ name: p.name, discipline: String(p.system.discipline), kind: String(p.system.kind) }));
  if (options.length === 0) return;
  const chosen = await g.deps.chooseDialog(options);
  if (chosen !== null && options.some((o) => o.name === chosen)) grant(g, chosen);
}

/** Wild talents never receive metapsionic powers or defense modes by choice. */
const choosable = (p: PackPower, kinds: readonly string[]): boolean => p.system.discipline !== "metapsionics" && kinds.includes(String(p.system.kind));

async function resolve(g: Grant, table: 12 | 13, result: WildResult): Promise<void> {
  switch (result.kind) {
    case "power":
      grant(g, result.name);
      return;
    case "roll":
      for (let n = 0; n < result.times; n++) await resolve(g, table, lookupWild(table, await g.deps.roll100()));
      return;
    case "table13":
      await resolve(g, 13, lookupWild(13, await g.deps.roll100()));
      return;
    case "chooseThenTable13":
      await pick(g, (p) => choosable(p, ["devotion"]));
      await resolve(g, 13, lookupWild(13, await g.deps.roll100()));
      return;
    case "choose":
      await pick(g, (p) => p.system.discipline === result.discipline && choosable(p, result.powerKinds));
      return;
    case "chooseAny": {
      // Table 13's "choose any science or devotion" is encoded (1 science, 0 devotions): one pick of either kind
      if (result.sciences === 1 && result.devotions === 0) {
        await pick(g, (p) => choosable(p, ["science", "devotion"]));
        return;
      }
      for (let n = 0; n < result.sciences; n++) await pick(g, (p) => choosable(p, ["science"]));
      for (let n = 0; n < result.devotions; n++) await pick(g, (p) => choosable(p, ["devotion"]));
    }
  }
}

/* ---------------------------------------------------------------------------
 * The test.
 * ------------------------------------------------------------------------- */

/** Template context of a wild-talent card. */
function buildWildView(v: {
  actor: WildActor;
  chance: number;
  parts: ReturnType<typeof chanceParts>;
  halved: boolean;
  roll: number;
  surgeon: boolean;
  effectiveRoll: number;
  talent: boolean;
  powers: string[];
  dire: DireOutcome | null;
  saved: boolean | null;
  flag: WildDireFlag | null;
}): Record<string, unknown> {
  const total = 1 + v.parts.wis + v.parts.con + v.parts.int + v.parts.level;
  return {
    actorName: v.actor.name,
    actorImg: v.actor.img,
    chance: v.chance,
    parts: v.parts,
    total,
    halved: v.halved,
    roll: v.roll,
    surgeon: v.surgeon,
    effectiveRoll: v.effectiveRoll,
    talent: v.talent,
    powers: v.powers,
    noPowers: v.talent && v.powers.length === 0,
    hasDire: v.dire !== null,
    direAbilityKey: `ADND2E.chat.wildTalent.ability.${v.dire?.ability ?? "wis"}`,
    direPenalty: v.dire?.savePenalty ?? 0,
    saved: v.saved === true,
    lossAll: v.flag?.points === "all",
    lossPoints: typeof v.flag?.points === "number" ? v.flag.points : 0,
    showApply: v.flag !== null,
  };
}

/** The once-per-character test for a wild talent (PHBR5 pp.19-21). */
export async function testWildTalent(actor: WildActor, opts: { surgeon: boolean }, deps: Partial<WildDeps> = {}): Promise<void> {
  const d = { ...defaultDeps(), ...deps };
  if (!d.settingOn()) {
    warn("ADND2E.sheet.wildTalent.settingOff");
    return;
  }
  if (actor.system.psionics.level > 0 && !actor.system.psionics.wild) {
    warn("ADND2E.sheet.wildTalent.psionicist");
    return;
  }
  if (actor.system.wildTalent.tested) {
    warn("ADND2E.sheet.wildTalent.alreadyTested");
    return;
  }
  if (actor.system.wildTalent.found) {
    warn("ADND2E.sheet.wildTalent.alreadyFound");
    return;
  }

  const level = highestClassLevel(actor);
  const raceItem = itemsOfType(actor, "race")[0];
  const halved = isHalved({
    classIds: itemsOfType(actor, "class").map((c) => String(c.system.chassisId)),
    raceId: raceItem ? String(raceItem.system.raceId) : "human",
  });
  const scores = { wis: actor.system.abilities.wis?.score ?? 0, con: actor.system.abilities.con?.score ?? 0, int: actor.system.abilities.int?.score ?? 0, level };
  const chance = wildTalentChance({ ...scores, halved });
  const roll = await d.roll100();
  const result = rollWildTest(chance, roll, opts.surgeon);

  // Powers (only for a talent), then ONE create and ONE actor update.
  const g: Grant = { deps: d, pack: [], taken: new Set(itemsOfType(actor, "power").map((p) => p.name)), granted: [] };
  if (result.talent) {
    g.pack = await d.readPack("powers");
    await resolve(g, 12, lookupWild(12, await d.roll100()));
  }

  // The dire check uses the SAME roll (ruling 1): the save, then the loss.
  const dire = result.dire;
  let saved: boolean | null = null;
  let flagDire: WildDireFlag | null = null;
  if (dire) {
    saved = await d.rollSave(actor, "ppd", { penalty: dire.savePenalty });
    if (!saved) flagDire = { ability: dire.ability, points: dire.ability === "all" ? "all" : await d.rollD6(), applied: false };
  }

  if (g.granted.length > 0) await actor.createEmbeddedDocuments("Item", g.granted.map(({ _id: _i, _key: _k, ...doc }) => doc));
  await actor.update(
    result.talent
      ? { "system.wildTalent.tested": true, "system.wildTalent.found": true, "system.wildTalent.levelAtDiscovery": level }
      : { "system.wildTalent.tested": true, "system.wildTalent.found": false },
  );
  if (result.talent) info("ADND2E.sheet.wildTalent.foundToast", { n: g.granted.length });
  else info("ADND2E.sheet.wildTalent.notFoundToast");

  const flag: WildFlag = { id: foundry.utils.randomID(), actorUuid: actor.uuid, dire: flagDire };
  const view = buildWildView({
    actor, chance, parts: chanceParts(scores), halved, roll, surgeon: opts.surgeon, effectiveRoll: result.effectiveRoll,
    talent: result.talent, powers: g.granted.map((p) => p.name), dire, saved, flag: flagDire,
  });
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/wild-talent.hbs"), view);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content, flags: { [SYSTEM_ID]: { wildTalent: flag } } } as never);
}

/* ---------------------------------------------------------------------------
 * Dire consequences.
 * ------------------------------------------------------------------------- */

/** Per-actor promise chains: dire writes for one actor run one at a time. */
const applyChains = new Map<string, Promise<unknown>>();

/** Applies the recorded dire loss of one card to its actor's BASE ability scores, once per card id. Returns whether it wrote. */
export function applyDire(messageId: string, deps: Partial<ApplyDeps> = {}): Promise<boolean> {
  const d = { ...defaultApplyDeps(), ...deps };
  const flag = d.getFlag(messageId);
  if (!flag?.dire) return Promise.resolve(false);
  const key = flag.actorUuid;
  const task = (applyChains.get(key) ?? Promise.resolve()).then(() => applyDireNow(flag, flag.dire!, d));
  const tail = task.catch(() => undefined); // a rejected write must not poison later calls
  applyChains.set(key, tail);
  void tail.then(() => {
    if (applyChains.get(key) === tail) applyChains.delete(key);
  });
  return task;
}

const appliedIds = (actor: WildActor): string[] => (actor.getFlag?.(SYSTEM_ID, "wildApplied") as string[] | undefined) ?? [];

async function applyDireNow(flag: WildFlag, dire: WildDireFlag, d: ApplyDeps): Promise<boolean> {
  const actor = d.getActor(flag.actorUuid);
  if (!actor) return false;
  if (!d.userIsGM() && !actor.isOwner) {
    warn("ADND2E.chat.wildTalent.notYours");
    return false;
  }
  if (appliedIds(actor).includes(flag.id)) {
    info("ADND2E.chat.wildTalent.alreadyApplied");
    return false;
  }
  const i18n = game.i18n!;
  const abilityName = dire.ability === "all" ? i18n.localize("ADND2E.chat.wildTalent.allAbilities") : i18n.localize(`ADND2E.chat.wildTalent.ability.${dire.ability}`);
  const amount = dire.points === "all" ? i18n.localize("ADND2E.chat.wildTalent.toThree") : i18n.format("ADND2E.chat.wildTalent.lose", { n: String(dire.points) });
  const ok = await d.confirm(i18n.localize("ADND2E.chat.wildTalent.confirmTitle"), i18n.format("ADND2E.chat.wildTalent.confirm", { actor: actor.name, ability: abilityName, amount }));
  if (!ok) return false;
  if (appliedIds(actor).includes(flag.id)) return false; // answered while the dialog was open
  const base = (k: string): number => actor._source?.system?.abilities?.[k]?.score ?? actor.system.abilities[k]?.score ?? 3;
  const update: Record<string, unknown> = {
    [`flags.${SYSTEM_ID}.wildApplied`]: [...appliedIds(actor), flag.id].slice(-MAX_APPLIED_IDS),
  };
  if (dire.points === "all") for (const k of ABILITY_KEYS) update[`system.abilities.${k}.score`] = 3;
  else {
    const k = dire.ability as "wis" | "int" | "con";
    update[`system.abilities.${k}.score`] = Math.max(3, base(k) - dire.points);
  }
  await actor.update(update);
  return true;
}

/** GM only: allows the character one more test (keeps `found` and the powers). */
export async function resetWildTest(actor: WildActor, deps: { userIsGM?: () => boolean } = {}): Promise<void> {
  if (!(deps.userIsGM ?? (() => Boolean(game.user?.isGM)))()) {
    warn("ADND2E.sheet.wildTalent.gmOnly");
    return;
  }
  await actor.update({ "system.wildTalent.tested": false });
  info("ADND2E.sheet.wildTalent.resetDone");
}

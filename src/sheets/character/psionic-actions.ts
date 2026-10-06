import { TEMPLATE_PATH } from "../../constants";
import { applyRecovery, canRelearn, checkCost, powerScore, rollPowerCheck, type Discipline, type KnownPower, type PowerKind, type RecoveryActivity } from "../../core/psionics";

/* SP15 Plan A - psionic power actions. Foundry glue only; the rules live in
 * src/core/psionics. Every write targets the acting actor's own
 * `system.psionics` (or its own power item), so a non-GM owner can use their
 * powers. */

export interface PsionicItem {
  id: string;
  name: string;
  type: string;
  system: Record<string, unknown>;
  update?(data: Record<string, unknown>): Promise<unknown>;
  delete?(): Promise<unknown>;
}

export interface PsionicActor {
  name: string;
  img: string;
  items: Iterable<PsionicItem>;
  system: {
    abilities: Record<string, { score: number }>;
    /** `level` is the derived cache: 0 = no active psionicist class */
    psionics: { psp: number | null; maintained: { powerId: string }[]; max: number; level: number };
  };
  update(data: Record<string, unknown>): Promise<unknown>;
}

export type PsionicRoll = () => Promise<number>;

/** The natural d20 of a fresh roll (the helper turning-actions uses). */
const rollD20: PsionicRoll = async () => {
  const d20 = await new Roll("1d20").evaluate();
  return d20.dice[0]?.total ?? d20.total;
};

const warn = (key: string, data?: Record<string, unknown>): void => {
  const i18n = game.i18n!;
  ui.notifications?.warn(data ? i18n.format(key, data as Record<string, string>) : i18n.localize(key));
};

const info = (key: string, data: Record<string, unknown>): void => {
  ui.notifications?.info(game.i18n!.format(key, data as Record<string, string>));
};

/** The effective current PSP: `psp ?? max`, clamped to the maximum. */
export function currentPsp(actor: PsionicActor): number {
  const { psp, max } = actor.system.psionics;
  return Math.min(psp ?? max, max);
}

const isPsionicist = (actor: PsionicActor): boolean => actor.system.psionics.level > 0;

const powerItems = (actor: PsionicActor): PsionicItem[] => [...actor.items].filter((i) => i.type === "power");

const findPower = (actor: PsionicActor, id: string): PsionicItem | undefined => powerItems(actor).find((i) => i.id === id);

/** The actor's owned powers as the learning rules see them. */
export function knownPowers(actor: PsionicActor): KnownPower[] {
  return powerItems(actor).map((i) => ({
    id: i.id,
    name: i.name,
    discipline: i.system.discipline as Discipline,
    kind: i.system.kind as PowerKind,
    scoreBonus: Number(i.system.scoreBonus ?? 0),
  }));
}

/** Refuses (toast) an actor with no active psionicist class (derived psionic level 0). */
function requirePsionicist(actor: PsionicActor): boolean {
  if (isPsionicist(actor)) return true;
  warn("ADND2E.sheet.psionics.noClass");
  return false;
}

/** Uses a power: d20 check against its score, pays the full or half cost, tracks maintenance, posts a card. */
export async function usePower(actor: PsionicActor, powerId: string, roll: PsionicRoll = rollD20): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const power = findPower(actor, powerId);
  if (!power) return;
  const cost = Number(power.system.initialCost ?? 0);
  const pool = currentPsp(actor);
  if (pool < cost) {
    warn("ADND2E.sheet.psionics.notEnoughPsp");
    return;
  }
  const abilityKey = String(power.system.abilityKey);
  const score = powerScore(actor.system.abilities[abilityKey]?.score ?? 0, Number(power.system.abilityModifier ?? 0) + Number(power.system.scoreBonus ?? 0));
  const natural = await roll();
  const check = rollPowerCheck(natural, score);
  const paid = checkCost(cost, check.success);
  const remaining = pool - paid;

  const update: Record<string, unknown> = { "system.psionics.psp": remaining };
  const maintained = actor.system.psionics.maintained;
  if (check.success && power.system.maintenanceUnit !== "none" && !maintained.some((m) => m.powerId === powerId)) {
    update["system.psionics.maintained"] = [...maintained, { powerId }];
  }
  await actor.update(update);

  const context = {
    actorName: actor.name,
    actorImg: actor.img,
    powerName: power.name,
    roll: natural,
    score,
    resultKey: `ADND2E.chat.psionic.result.${check.result}`,
    special: check.special,
    cost: paid,
    remaining,
    max: actor.system.psionics.max,
  };
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/psionic-power-use.hbs"), context);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
}

/** Relearns a known power: +1 to its score, spending one slot of its kind. */
export async function relearnPower(actor: PsionicActor, powerId: string): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const power = findPower(actor, powerId);
  if (!power) return;
  const verdict = canRelearn(knownPowers(actor), powerId, actor.system.psionics.level);
  if (!verdict.ok) {
    warn(`ADND2E.sheet.psionics.learn.${verdict.reason}`);
    return;
  }
  await power.update?.({ "system.scoreBonus": Number(power.system.scoreBonus ?? 0) + 1 });
  info("ADND2E.sheet.psionics.relearned", { power: power.name });
}

/** Recovers PSPs for `hours` hours of one activity; refused while a power is maintained (entries whose power item is gone are pruned, not counted). */
export async function rest(actor: PsionicActor, activity: RecoveryActivity, hours: number): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const maintained = actor.system.psionics.maintained;
  if (maintained.some((m) => findPower(actor, m.powerId))) {
    warn("ADND2E.sheet.psionics.restBlocked");
    return;
  }
  const { max } = actor.system.psionics;
  const recovered = applyRecovery(currentPsp(actor), max, activity, hours);
  // a full pool is stored as null so a later level-up's larger maximum is full too
  const update: Record<string, unknown> = { "system.psionics.psp": recovered >= max ? null : recovered };
  // an entry whose power item was deleted must not block rest: prune it in the same write
  if (maintained.length > 0) update["system.psionics.maintained"] = [];
  await actor.update(update);
}

/** Pays one unit of maintenance for one maintained power (null = every one, in list order); an unaffordable power ends. */
export async function payMaintenance(actor: PsionicActor, powerId: string | null): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const maintained = actor.system.psionics.maintained;
  const targets = maintained.filter((m) => powerId === null || m.powerId === powerId).map((m) => m.powerId);
  if (targets.length === 0) return;
  let pool = currentPsp(actor);
  const ended = new Set<string>();
  for (const id of targets) {
    const power = findPower(actor, id);
    if (!power) {
      ended.add(id); // the power item is gone: nothing to pay, nothing to maintain
      continue;
    }
    const cost = Number(power.system.maintenanceCost ?? 0);
    if (pool >= cost) {
      pool -= cost;
    } else {
      ended.add(id);
      warn("ADND2E.sheet.psionics.maintenanceEnded", { power: power.name });
    }
  }
  const update: Record<string, unknown> = { "system.psionics.psp": pool };
  if (ended.size > 0) update["system.psionics.maintained"] = maintained.filter((m) => !ended.has(m.powerId));
  await actor.update(update);
}

/** Adds (positive) or spends (negative) PSPs by hand, for variable costs. A pool that reaches the maximum is stored as null (full). */
export async function adjustPsp(actor: PsionicActor, delta: number): Promise<void> {
  if (!requirePsionicist(actor)) return;
  if (!Number.isInteger(delta) || delta === 0) return;
  const { max } = actor.system.psionics;
  const pool = currentPsp(actor);
  if (delta < 0 && pool < -delta) {
    warn("ADND2E.sheet.psionics.notEnoughPsp");
    return;
  }
  const next = Math.min(pool + delta, max);
  await actor.update({ "system.psionics.psp": next >= max ? null : next });
}

/** Ends a maintained power without paying. */
export async function endPower(actor: PsionicActor, powerId: string): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const maintained = actor.system.psionics.maintained;
  if (!maintained.some((m) => m.powerId === powerId)) return;
  await actor.update({ "system.psionics.maintained": maintained.filter((m) => m.powerId !== powerId) });
}

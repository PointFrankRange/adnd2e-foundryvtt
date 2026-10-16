import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import { checkCost, powerScore, rollPowerCheck } from "../../core/psionics";
import {
  FULL_CONTACT, attackModifier, breakTangents, endContact, isAttackMode, isDefenseMode, needsDefenseRoll, recordTangents, resolveContest, resolveSeries, switchTarget, tangentsOn, upkeepDue,
  type AttackStep, type SeriesOutcome,
  applyLateTangents,
} from "../../core/psionics/combat";
import { noteInitiation } from "./psionic-round";
import { contactedAttack, defaultRollDice, defaultRollSave, type EffectDeps } from "./psionic-effects";
import { armorPenaltyOf, currentPsp, findPower, info, requirePsionicist, rollD20, warn, type PsionicActor, type PsionicItem, type PsionicRoll } from "./psionic-actions";

/* SP15 Plan C - psionic combat state actions (active defense, upkeep, contacts).
 * Foundry glue only; every write targets the acting actor's own `system.psionics`. */

/** Raises a defense mode: pays its initial cost and marks it active. */
export async function raiseDefense(actor: PsionicActor, powerId: string): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const power = findPower(actor, powerId);
  if (!power || power.system.kind !== "defense" || !isDefenseMode(power.name)) return;
  if (actor.system.psionics.activeDefense === powerId) {
    info("ADND2E.sheet.psionics.combat.alreadyRaised");
    return;
  }
  const cost = Number(power.system.initialCost ?? 0);
  const pool = currentPsp(actor);
  if (pool < cost) {
    warn("ADND2E.sheet.psionics.notEnoughPsp");
    return;
  }
  await actor.update({ "system.psionics.psp": pool - cost, "system.psionics.activeDefense": powerId });
}

/** Drops the raised defense mode (no cost). */
export async function dropDefense(actor: PsionicActor): Promise<void> {
  if (!requirePsionicist(actor)) return;
  if (actor.system.psionics.activeDefense === "") return;
  await actor.update({ "system.psionics.activeDefense": "" });
}

/** Pays one PSP to hold the partial tangents for a round; with none to spend they break. */
export async function payUpkeep(actor: PsionicActor): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const contacts = actor.system.psionics.contacts;
  if (upkeepDue(contacts) === 0) {
    info("ADND2E.sheet.psionics.combat.noUpkeep");
    return;
  }
  const pool = currentPsp(actor);
  if (pool >= 1) {
    await actor.update({ "system.psionics.psp": pool - 1 });
    return;
  }
  warn("ADND2E.sheet.psionics.combat.tangentsBroken");
  await actor.update({ "system.psionics.contacts": breakTangents(contacts) });
}

/** Ends the contact with one target. */
export async function endContactAction(actor: PsionicActor, target: string): Promise<void> {
  if (!requirePsionicist(actor)) return;
  await actor.update({ "system.psionics.contacts": endContact(actor.system.psionics.contacts, target) });
}

/* ---------------------------------------------------------------------------
 * Attack modes as psychic contests (SP15 Plan C, Task 3).
 * Every write targets the acting user's own actor; the target actor is only READ.
 * ------------------------------------------------------------------------- */

export interface TargetActor {
  uuid: string;
  name: string;
  isOwner?: boolean;
  items: Iterable<PsionicItem>;
  system: { abilities?: Record<string, { score: number }>; psionics?: { level: number; activeDefense: string; wild?: boolean } };
  testUserPermission?(user: unknown, level: string): boolean;
}
export interface TargetLike { name: string; uuid: string; actor: TargetActor | null }
export interface AttackDeps {
  roll: PsionicRoll;
  targets: () => TargetLike[];
  hasOnlineOwner: (target: TargetActor) => boolean;
  /** issue #178: the users who may answer a pending card (GMs and the target's owners) */
  answerUserIds: (target: TargetActor) => string[];
  /** issue #180: dice and the target's save for an attack on a contacted mind */
  rollDice: EffectDeps["rollDice"];
  rollSave: EffectDeps["rollSave"];
  userId: string;
}

/** The data carried in `flags.adnd2e.psionicContest` on a contest chat card. */
export interface ContestFlag {
  id: string;
  attackerActorUuid: string;
  attackerUserId: string;
  attackerName: string;
  attackerImg: string;
  targetActorUuid: string;
  targetName: string;
  powerName: string;
  /** score is the EFFECTIVE defense score; maintained = the raised defense gets the p.24 maintained-power rule */
  defense: { name: string; score: number; maintained?: boolean } | null;
  /** issue #178: GM + owner user ids that could answer this card when it was posted */
  answerUserIds?: string[];
  modifier: number;
  steps: AttackStep[];
  startingTangents: number;
  state: "pending" | "resolved";
  paid: number;
  remaining: number;
  max: number;
  outcome?: SeriesOutcome;
  applied?: boolean;
}

const MAX_APPLIED_IDS = 50;

const defaultTargets = (): TargetLike[] =>
  [...(game as unknown as { user: { targets: Iterable<{ name: string; actor: TargetActor | null }> } }).user.targets].flatMap((t) =>
    t.actor ? [{ name: t.name, uuid: t.actor.uuid, actor: t.actor }] : [],
  );

/** True when a non-GM user with OWNER permission on the actor is connected. */
const defaultHasOnlineOwner = (target: TargetActor): boolean =>
  [...(game as unknown as { users: Iterable<{ isGM: boolean; active: boolean }> }).users].some(
    (u) => !u.isGM && u.active && (target.testUserPermission?.(u, "OWNER") ?? false),
  );

/** Issue #178: every user who can answer a pending defense - the GMs and the target's owners (recorded on the card at attack time). */
const defaultAnswerUserIds = (target: TargetActor): string[] =>
  [...(game as unknown as { users: Iterable<{ id: string; isGM: boolean }> }).users]
    .filter((u) => u.isGM || (target.testUserPermission?.(u, "OWNER") ?? false))
    .map((u) => u.id);

/**
 * Issue #178: the attacker may roll a pending defense themselves once nobody who could answer it is online
 * (the same thing that happens when the defender is offline at attack time). Cards from before the answerer
 * list existed never allow it.
 */
export function attackerMayAnswer(contest: ContestFlag, userId: string, isActive: (id: string) => boolean): boolean {
  if (contest.state !== "pending" || contest.attackerUserId !== userId || !contest.answerUserIds) return false;
  return contest.answerUserIds.every((id) => !isActive(id));
}

/** The target's raised defense mode and its score from the TARGET's own ability scores; null = undefended. */
function targetDefense(target: TargetActor): { name: string; score: number; maintained: boolean } | null {
  const psionics = target.system.psionics;
  if (!psionics || psionics.level <= 0 || psionics.activeDefense === "") return null;
  const item = [...target.items].find((i) => i.id === psionics.activeDefense && i.type === "power");
  if (!item || item.system.kind !== "defense") return null;
  const ability = target.system.abilities?.[String(item.system.abilityKey)]?.score ?? 0;
  // issue #122: a raised defense is a maintained power (p.24): +1 to its score (a failed check counts as a success of 1, see resolveContest)
  return { name: item.name, score: powerScore(ability, Number(item.system.abilityModifier ?? 0) + Number(item.system.scoreBonus ?? 0) + armorPenaltyOf(target) + 1), maintained: true };
}

/** Dry run: does any attack that would be made need the defender's roll? */
function defenseRollNeeded(steps: readonly AttackStep[], defenseScore: number | null, starting: number): boolean {
  let tangents = starting;
  for (const s of steps) {
    if (tangents >= FULL_CONTACT) continue;
    if (needsDefenseRoll(s.roll, s.score, defenseScore)) return true;
    if (rollPowerCheck(s.roll, s.score).success) tangents += 1; // no roll needed: a success is an automatic or unopposed win
  }
  return false;
}

/** Rolls the defense d20 for each attack that will be made and needs one. */
async function rollDefenses(steps: readonly AttackStep[], defenseScore: number | null, starting: number, roll: PsionicRoll, maintained = false): Promise<(number | null)[]> {
  const rolls: (number | null)[] = [];
  let tangents = starting;
  for (const s of steps) {
    if (tangents >= FULL_CONTACT) {
      rolls.push(null);
      continue;
    }
    const defenseRoll = needsDefenseRoll(s.roll, s.score, defenseScore) ? await roll() : null;
    rolls.push(defenseRoll);
    if (resolveContest({ attackRoll: s.roll, attackScore: s.score, defenseRoll, defenseScore, defenseMaintained: maintained }).winner === "attacker") tangents += 1;
  }
  return rolls;
}

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** The template context of a contest card. */
function buildContestView(c: ContestFlag): Record<string, unknown> {
  const i18n = game.i18n!;
  const gained = c.outcome?.tangentsGained ?? 0;
  const total = Math.min(FULL_CONTACT, c.startingTangents + gained);
  const pending = c.state === "pending";
  return {
    attackerName: c.attackerName,
    attackerImg: c.attackerImg,
    targetName: c.targetName,
    powerName: c.powerName,
    pending,
    undefended: c.defense === null,
    defenseName: c.defense?.name ?? "",
    defenseScore: c.defense?.score ?? 0,
    modifierText: c.modifier === 0 ? "" : signed(c.modifier),
    steps: c.steps.map((s, i) => {
      const o = c.outcome?.steps[i];
      const check = rollPowerCheck(s.roll, s.score);
      return {
        n: i + 1,
        roll: s.roll,
        score: s.score,
        attackResultKey: `ADND2E.chat.psionic.result.${check.result}`,
        notMade: o ? !o.made : c.startingTangents >= FULL_CONTACT,
        defenseRoll: o?.defenseRoll ?? null,
        hasDefenseRoll: o?.defenseRoll !== null && o?.defenseRoll !== undefined,
        // issue #122: a maintained defense's failed check is shown as a 1 on the card (the raw roll is kept)
        defenseCountsAsOne: Boolean(c.defense?.maintained) && o?.defenseRoll !== null && o?.defenseRoll !== undefined && !rollPowerCheck(o.defenseRoll, c.defense?.score ?? 0).success,
        winnerKey: o?.result ? `ADND2E.chat.psionicContest.winner.${o.result.winner}` : "",
        reasonKey: o?.result ? `ADND2E.chat.psionicContest.reason.${o.result.reason}` : "",
        resolved: Boolean(o?.result),
      };
    }),
    paid: c.paid,
    remaining: c.remaining,
    max: c.max,
    showTangents: !pending,
    tangentText: total >= FULL_CONTACT ? i18n.localize("ADND2E.sheet.psionics.combat.fullContact") : i18n.format("ADND2E.sheet.psionics.combat.tangents", { n: String(total) }),
    showRecord: !pending && c.applied !== true && gained > 0,
    showRoll: pending,
  };
}

/** `keepId` posts the card under the contest's own id so the server rejects a second answer to the same pending card (issue #122). */
async function postContestCard(c: ContestFlag, speaker: unknown, keepId = false): Promise<void> {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/psionic-contest.hbs"), buildContestView(c));
  const data = { speaker, content, flags: { [SYSTEM_ID]: { psionicContest: c } }, ...(keepId ? { _id: c.id } : {}) };
  await ChatMessage.create(data as never, keepId ? ({ keepId: true } as never) : undefined);
}

/** Per-attacker promise chains: every contacts write for one actor runs one at a time (attackMode and applyContestTangents share it). */
const applyChains = new Map<string, Promise<unknown>>();

function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const task = (applyChains.get(key) ?? Promise.resolve()).then(fn);
  const tail = task.catch(() => undefined); // a rejected write must not poison later calls
  applyChains.set(key, tail);
  void tail.then(() => {
    if (applyChains.get(key) === tail) applyChains.delete(key);
  });
  return task;
}

/** An attack mode: two attacks, each a psychic contest (PHBR5 pp.22-27). */
export async function attackMode(actor: PsionicActor, powerId: string, deps: Partial<AttackDeps> = {}): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const power = findPower(actor, powerId);
  if (!power || !isAttackMode(power.name)) return;
  const roll = deps.roll ?? rollD20;
  const target = (deps.targets ?? defaultTargets)()[0];
  if (!target || !target.actor) {
    warn("ADND2E.sheet.psionics.combat.noTarget");
    return;
  }
  const attackerUuid = actor.uuid ?? "";
  if ((target.actor as unknown) === actor || (attackerUuid !== "" && target.uuid === attackerUuid)) {
    warn("ADND2E.sheet.psionics.combat.selfTarget");
    return;
  }
  if (tangentsOn(actor.system.psionics.contacts, target.uuid) >= FULL_CONTACT) {
    // issue #180: the mind is open - one power check and the mode's effect instead of a contest
    await contactedAttack(actor, power, target as never, {
      roll,
      rollDice: deps.rollDice ?? defaultRollDice,
      rollSave: deps.rollSave ?? defaultRollSave,
      writePsp: (remaining) => serialize(attackerUuid, () => actor.update({ "system.psionics.psp": remaining })),
    });
    return;
  }
  const cost = Number(power.system.initialCost ?? 0);
  const pool = currentPsp(actor);
  if (pool < cost) {
    warn("ADND2E.sheet.psionics.notEnoughPsp");
    return;
  }

  await noteInitiation(actor, power);
  const defense = targetDefense(target.actor);
  const modifier = attackModifier(power.name, defense?.name ?? null);
  const base = powerScore(actor.system.abilities[String(power.system.abilityKey)]?.score ?? 0, Number(power.system.abilityModifier ?? 0) + Number(power.system.scoreBonus ?? 0) + armorPenaltyOf(actor));
  const steps: AttackStep[] = [{ roll: await roll(), score: base + modifier }, { roll: await roll(), score: base + modifier }];
  const starting = tangentsOn(actor.system.psionics.contacts, target.uuid);
  const defenseScore = defense?.score ?? null;
  const userId = deps.userId ?? (game.user as unknown as { id: string }).id;

  const contest: ContestFlag = {
    id: foundry.utils.randomID(),
    attackerActorUuid: attackerUuid,
    attackerUserId: userId,
    attackerName: actor.name,
    attackerImg: actor.img,
    targetActorUuid: target.uuid,
    targetName: target.name,
    powerName: power.name,
    defense,
    answerUserIds: (deps.answerUserIds ?? defaultAnswerUserIds)(target.actor),
    modifier,
    steps,
    startingTangents: starting,
    state: "pending",
    paid: 0,
    remaining: pool,
    max: actor.system.psionics.max,
  };
  const speaker = ChatMessage.getSpeaker({ actor: actor as never });


  const pending = defense !== null && defenseRollNeeded(steps, defenseScore, starting) && (deps.hasOnlineOwner ?? defaultHasOnlineOwner)(target.actor);
  if (pending) {
    const anySuccess = starting < FULL_CONTACT && steps.some((s) => rollPowerCheck(s.roll, s.score).success);
    contest.paid = checkCost(cost, anySuccess);
    contest.remaining = pool - contest.paid;
    await serialize(attackerUuid, async () => {
      const pendingUpdate: Record<string, unknown> = { "system.psionics.psp": contest.remaining };
      const switched = switchTarget(actor.system.psionics.contacts, target.uuid); // p.27: a different target breaks the old partial tangents
      if (switched.length !== actor.system.psionics.contacts.length) pendingUpdate["system.psionics.contacts"] = switched;
      await actor.update(pendingUpdate);
    });
    await postContestCard(contest, speaker);
    return;
  }

  const maintained = defense?.maintained ?? false;
  const outcome = resolveSeries(steps, defenseScore, await rollDefenses(steps, defenseScore, starting, roll, maintained), starting, maintained);
  contest.paid = checkCost(cost, outcome.anySuccess);
  contest.remaining = pool - contest.paid;
  contest.state = "resolved";
  contest.outcome = outcome;
  contest.applied = true; // the update below records the tangents; the result hook must skip this card
  await serialize(attackerUuid, async () => {
    // computed inside the chain, AFTER the dice awaits, so a concurrently applied pending result is not overwritten with a stale list
    const update: Record<string, unknown> = { "system.psionics.psp": contest.remaining };
    if (outcome.tangentsGained > 0) update["system.psionics.contacts"] = recordTangents(actor.system.psionics.contacts, target.uuid, target.name, outcome.tangentsGained);
    else {
      const switchedNow = switchTarget(actor.system.psionics.contacts, target.uuid);
      if (switchedNow.length !== actor.system.psionics.contacts.length) update["system.psionics.contacts"] = switchedNow;
    }
    await actor.update(update);
  });
  await postContestCard(contest, speaker);
}

/** Contest ids whose defense roll is in flight in this client (a double click must not answer twice). */
const answering = new Set<string>();

/** The defender's "Roll defense" button on a pending card: rolls, posts the resolved card. Refuses a non-owner non-GM and a second answer. */
export async function rollDefense(messageId: string, deps: { roll?: PsionicRoll } = {}): Promise<void> {
  const g = game as unknown as {
    user: { isGM: boolean; id: string };
    users: { get(id: string): { active: boolean } | undefined };
    messages: Iterable<{ getFlag(s: string, k: string): unknown }> & { get(id: string): { getFlag(s: string, k: string): unknown } | undefined };
  };
  const contest = g.messages.get(messageId)?.getFlag(SYSTEM_ID, "psionicContest") as ContestFlag | undefined;
  if (!contest || contest.state !== "pending" || contest.defense === null) return;
  const targetActor = foundry.utils.fromUuidSync(contest.targetActorUuid) as TargetActor | null;
  const fallback = attackerMayAnswer(contest, g.user.id, (id) => g.users.get(id)?.active ?? false);
  if (!g.user.isGM && !targetActor?.isOwner && !fallback) {
    warn("ADND2E.chat.psionicContest.notYourDefense");
    return;
  }
  const answered = [...g.messages].some((m) => {
    const f = m.getFlag(SYSTEM_ID, "psionicContest") as ContestFlag | undefined;
    return f?.id === contest.id && f.state === "resolved";
  });
  if (answered || answering.has(contest.id)) {
    warn("ADND2E.chat.psionicContest.alreadyAnswered");
    return;
  }
  answering.add(contest.id); // synchronously, before the first await
  try {
    const maintained = contest.defense.maintained ?? false;
    const defenseRolls = await rollDefenses(contest.steps, contest.defense.score, contest.startingTangents, deps.roll ?? rollD20, maintained);
    const outcome = resolveSeries(contest.steps, contest.defense.score, defenseRolls, contest.startingTangents, maintained);
    const speaker = targetActor ? ChatMessage.getSpeaker({ actor: targetActor as never }) : { alias: contest.targetName };
    try {
      await postContestCard({ ...contest, state: "resolved", outcome, applied: false }, speaker, true);
    } catch {
      // the server rejected a duplicate id: another client (owner or GM) answered this card first
      warn("ADND2E.chat.psionicContest.alreadyAnswered");
    }
  } finally {
    answering.delete(contest.id);
  }
}

/** Records a resolved contest's tangents on the attacker's actor, once per contest id. Returns whether it wrote. */
export function applyContestTangents(contest: ContestFlag): Promise<boolean> {
  return serialize(contest.attackerActorUuid, () => applyContestTangentsNow(contest));
}

async function applyContestTangentsNow(contest: ContestFlag): Promise<boolean> {
  const gained = contest.outcome?.tangentsGained ?? 0;
  if (gained <= 0) return false;
  const actor = foundry.utils.fromUuidSync(contest.attackerActorUuid) as (PsionicActor & { isOwner: boolean; getFlag(s: string, k: string): unknown }) | null;
  if (!actor || !actor.isOwner) return false;
  const applied = (actor.getFlag(SYSTEM_ID, "psionicApplied") as string[] | undefined) ?? [];
  if (applied.includes(contest.id)) return false;
  // issue #122: a late result must not break the tangents of the attacker's newer target
  const late = applyLateTangents(actor.system.psionics.contacts, contest.targetActorUuid, contest.targetName, gained);
  if (late.stale) info("ADND2E.sheet.psionics.combat.staleTangents", { name: contest.targetName });
  await actor.update({
    "system.psionics.contacts": late.contacts,
    [`flags.${SYSTEM_ID}.psionicApplied`]: [...applied, contest.id].slice(-MAX_APPLIED_IDS),
  });
  return true;
}

/** What the contest card's tangent control shows to one viewer: the Record button (still
 *  eligible and the viewer may record it), a "recorded" line (already recorded; shown to
 *  every viewer who can see the card), or nothing (no tangents to record, or not recorded yet
 *  and this viewer cannot record it). */
export function recordButtonState(contest: ContestFlag, actorApplied: string[], viewerIsOwnerOrGm: boolean): "button" | "recorded" | "none" {
  if (contest.state !== "resolved" || (contest.outcome?.tangentsGained ?? 0) <= 0) return "none";
  if (contest.applied === true || actorApplied.includes(contest.id)) return "recorded";
  return viewerIsOwnerOrGm ? "button" : "none";
}

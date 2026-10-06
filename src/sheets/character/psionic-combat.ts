import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import { checkCost, powerScore, rollPowerCheck } from "../../core/psionics";
import {
  FULL_CONTACT, attackModifier, breakTangents, endContact, isAttackMode, isDefenseMode, needsDefenseRoll, recordTangents, resolveContest, resolveSeries, tangentsOn, upkeepDue,
  type AttackStep, type SeriesOutcome,
} from "../../core/psionics/combat";
import { currentPsp, findPower, info, requirePsionicist, rollD20, warn, type PsionicActor, type PsionicItem, type PsionicRoll } from "./psionic-actions";

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
  system: { abilities?: Record<string, { score: number }>; psionics?: { level: number; activeDefense: string } };
  testUserPermission?(user: unknown, level: string): boolean;
}
export interface TargetLike { name: string; uuid: string; actor: TargetActor | null }
export interface AttackDeps {
  roll: PsionicRoll;
  targets: () => TargetLike[];
  hasOnlineOwner: (target: TargetActor) => boolean;
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
  defense: { name: string; score: number } | null;
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

/** The target's raised defense mode and its score from the TARGET's own ability scores; null = undefended. */
function targetDefense(target: TargetActor): { name: string; score: number } | null {
  const psionics = target.system.psionics;
  if (!psionics || psionics.level <= 0 || psionics.activeDefense === "") return null;
  const item = [...target.items].find((i) => i.id === psionics.activeDefense && i.type === "power");
  if (!item || item.system.kind !== "defense") return null;
  const ability = target.system.abilities?.[String(item.system.abilityKey)]?.score ?? 0;
  return { name: item.name, score: powerScore(ability, Number(item.system.abilityModifier ?? 0) + Number(item.system.scoreBonus ?? 0)) };
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
async function rollDefenses(steps: readonly AttackStep[], defenseScore: number | null, starting: number, roll: PsionicRoll): Promise<(number | null)[]> {
  const rolls: (number | null)[] = [];
  let tangents = starting;
  for (const s of steps) {
    if (tangents >= FULL_CONTACT) {
      rolls.push(null);
      continue;
    }
    const defenseRoll = needsDefenseRoll(s.roll, s.score, defenseScore) ? await roll() : null;
    rolls.push(defenseRoll);
    if (resolveContest({ attackRoll: s.roll, attackScore: s.score, defenseRoll, defenseScore }).winner === "attacker") tangents += 1;
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

async function postContestCard(c: ContestFlag, speaker: unknown): Promise<void> {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/psionic-contest.hbs"), buildContestView(c));
  await ChatMessage.create({ speaker, content, flags: { [SYSTEM_ID]: { psionicContest: c } } } as never);
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
  const cost = Number(power.system.initialCost ?? 0);
  const pool = currentPsp(actor);
  if (pool < cost) {
    warn("ADND2E.sheet.psionics.notEnoughPsp");
    return;
  }

  const defense = targetDefense(target.actor);
  const modifier = attackModifier(power.name, defense?.name ?? null);
  const base = powerScore(actor.system.abilities[String(power.system.abilityKey)]?.score ?? 0, Number(power.system.abilityModifier ?? 0) + Number(power.system.scoreBonus ?? 0));
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
    await actor.update({ "system.psionics.psp": contest.remaining });
    await postContestCard(contest, speaker);
    return;
  }

  const outcome = resolveSeries(steps, defenseScore, await rollDefenses(steps, defenseScore, starting, roll), starting);
  contest.paid = checkCost(cost, outcome.anySuccess);
  contest.remaining = pool - contest.paid;
  contest.state = "resolved";
  contest.outcome = outcome;
  contest.applied = true; // the update below records the tangents; the result hook must skip this card
  const update: Record<string, unknown> = { "system.psionics.psp": contest.remaining };
  if (outcome.tangentsGained > 0) update["system.psionics.contacts"] = recordTangents(actor.system.psionics.contacts, target.uuid, target.name, outcome.tangentsGained);
  await actor.update(update);
  await postContestCard(contest, speaker);
}

/** The defender's "Roll defense" button on a pending card: rolls, posts the resolved card. Refuses a non-owner non-GM and a second answer. */
export async function rollDefense(messageId: string, deps: { roll?: PsionicRoll } = {}): Promise<void> {
  const g = game as unknown as {
    user: { isGM: boolean };
    messages: Iterable<{ getFlag(s: string, k: string): unknown }> & { get(id: string): { getFlag(s: string, k: string): unknown } | undefined };
  };
  const contest = g.messages.get(messageId)?.getFlag(SYSTEM_ID, "psionicContest") as ContestFlag | undefined;
  if (!contest || contest.state !== "pending" || contest.defense === null) return;
  const targetActor = foundry.utils.fromUuidSync(contest.targetActorUuid) as TargetActor | null;
  if (!g.user.isGM && !targetActor?.isOwner) {
    warn("ADND2E.chat.psionicContest.notYourDefense");
    return;
  }
  const answered = [...g.messages].some((m) => {
    const f = m.getFlag(SYSTEM_ID, "psionicContest") as ContestFlag | undefined;
    return f?.id === contest.id && f.state === "resolved";
  });
  if (answered) {
    warn("ADND2E.chat.psionicContest.alreadyAnswered");
    return;
  }
  const defenseRolls = await rollDefenses(contest.steps, contest.defense.score, contest.startingTangents, deps.roll ?? rollD20);
  const outcome = resolveSeries(contest.steps, contest.defense.score, defenseRolls, contest.startingTangents);
  const speaker = targetActor ? ChatMessage.getSpeaker({ actor: targetActor as never }) : { alias: contest.targetName };
  await postContestCard({ ...contest, state: "resolved", outcome, applied: false }, speaker);
}

/** Records a resolved contest's tangents on the attacker's actor, once per contest id. Returns whether it wrote. */
export async function applyContestTangents(contest: ContestFlag): Promise<boolean> {
  const gained = contest.outcome?.tangentsGained ?? 0;
  if (gained <= 0) return false;
  const actor = foundry.utils.fromUuidSync(contest.attackerActorUuid) as (PsionicActor & { isOwner: boolean; getFlag(s: string, k: string): unknown }) | null;
  if (!actor || !actor.isOwner) return false;
  const applied = (actor.getFlag(SYSTEM_ID, "psionicApplied") as string[] | undefined) ?? [];
  if (applied.includes(contest.id)) return false;
  await actor.update({
    "system.psionics.contacts": recordTangents(actor.system.psionics.contacts, contest.targetActorUuid, contest.targetName, gained),
    [`flags.${SYSTEM_ID}.psionicApplied`]: [...applied, contest.id].slice(-MAX_APPLIED_IDS),
  });
  return true;
}

import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import { canAct, contestAllowed } from "../../combat/condition-effects";
import { grappleRecordOf } from "../../combat/grapple-state";
import { buildContestView, type ContestKind, type WrestleContestFlag, type WrestleSide } from "../../combat/wrestling-card";
import type { RelayRequest } from "../../combat/apply-relay";
import {
  LOCK_SPECS, bodyModifier, canUseLock, gripOutcome, lockDamageFormula, nextPressCount, resolveOpposed, sideResult, sizeModifier,
  temporaryDamage, wrestlingDefenseAc, type GrappleRecord, type LockEffectId,
} from "../../core/wrestling";
import type { EffectTarget } from "../../relay/apply-effect";
import { requestApply } from "../../relay/relay-client";
import { getOptionalRules } from "../../settings";
import { resolveTargetCombatInfo } from "./combat-rolls";

/* SP7e - wrestling (C&T ch.5). Foundry glue; the rules live in core/wrestling. Writes to either actor go through
 * requestApply (local for a GM/owner, otherwise the GM relay). Dev-world verified. */

export type WrestleActor = EffectTarget & {
  uuid: string;
  name: string;
  img: string;
  isOwner: boolean;
  type: string;
  statuses: ReadonlySet<string>;
  system: Record<string, unknown> & { attributes: { hp: { value: number; max: number; nonlethal?: number } } };
  items: Iterable<{ type: string; system: Record<string, unknown> }>;
  effects: Iterable<{ statuses: ReadonlySet<string>; getFlag(scope: string, key: string): unknown }>;
};

const warn = (key: string): void => void ui.notifications?.warn(game.i18n!.localize(key));
const d20 = async (): Promise<number> => (await new Roll("1d20").evaluate()).total ?? 1;
const actorOf = (uuid: string): WrestleActor | null => foundry.utils.fromUuidSync(uuid as never) as unknown as WrestleActor | null;
/** "1d2" plus a signed Strength damage adjustment. */
const strengthDamage = (adj: number): string => (adj === 0 ? "1d2" : `1d2${adj > 0 ? "+" : "-"}${Math.abs(adj)}`);

/** Reads one wrestler's numbers from their actor (PC/NPC and creature actors store them differently). */
export function wrestlerStats(actor: WrestleActor): WrestleSide {
  const sys = actor.system as unknown as {
    attributes?: { thac0?: { base?: number; value?: number } };
    abilities?: { str?: { mods?: { hitProb?: number; damageAdj?: number } }; dex?: { mods?: { defensiveAdj?: number } } };
  };
  const isCreature = actor.type === "creature";
  // PCs/Character NPCs: the Strength-free base THAC0 (melee already folds Strength in, and strHit is added to the roll below).
  const thac0 = (isCreature ? sys.attributes?.thac0?.value : sys.attributes?.thac0?.base) ?? 20;
  const info = resolveTargetCombatInfo(actor);
  const magicBonus = isCreature
    ? 0
    : [...actor.items].filter((i) => i.type === "armor" && i.system.equipped === true).reduce((n, i) => n + Number(i.system.magicBonus ?? 0), 0);
  return {
    uuid: actor.uuid, name: actor.name, img: actor.img, size: info.size ?? "medium",
    thac0, strHit: sys.abilities?.str?.mods?.hitProb ?? 0, strDmg: sys.abilities?.str?.mods?.damageAdj ?? 0,
    ac: wrestlingDefenseAc({ dexDefensiveAdj: sys.abilities?.dex?.mods?.defensiveAdj ?? 0, magicBonus }),
  };
}

/** Actor uuids with a contest being started in this client (a double click must not post two cards). */
const starting = new Set<string>();

const myRecord = (actor: WrestleActor): GrappleRecord | null => grappleRecordOf(actor.effects);

async function postContest(flag: WrestleContestFlag): Promise<void> {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/wrestling-contest.hbs"), buildContestView(flag));
  const actor = actorOf(flag.initiator.uuid);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }), content, flags: { [SYSTEM_ID]: { wrestleContest: flag } },
  } as never);
}

/** Rolls `formula` and returns the total (0 for a null formula). */
async function rollDamage(formula: string | null): Promise<number> {
  if (formula === null) return 0;
  return Math.max(0, (await new Roll(formula).evaluate()).total ?? 0);
}

const targetOf = (): WrestleActor | null => {
  const targets = [...(game as unknown as { user: { targets: Iterable<{ actor: WrestleActor | null }> } }).user.targets];
  return targets.length === 1 ? targets[0]!.actor : null;
};

/** The "Wrestle" button: a wrestling attack against the target's wrestling AC. */
export async function startWrestle(actor: WrestleActor): Promise<void> {
  const rules = getOptionalRules();
  if (!rules.combatAndTacticsEnabled || !rules.wrestling) return;
  if (starting.has(actor.uuid)) return;
  starting.add(actor.uuid); // synchronously, before the first await
  try {
    await wrestleAttack(actor);
  } finally {
    starting.delete(actor.uuid);
  }
}

async function wrestleAttack(actor: WrestleActor): Promise<void> {
  if (!canAct(actor.statuses)) return warn("ADND2E.chat.wrestling.cannotAct");
  if (myRecord(actor)) return warn("ADND2E.chat.wrestling.alreadyGrappling");
  const target = targetOf();
  if (!target) return warn("ADND2E.chat.wrestling.noTarget");
  if (target.uuid === actor.uuid) return warn("ADND2E.chat.wrestling.selfTarget");
  if (myRecord(target)) return warn("ADND2E.chat.wrestling.alreadyGrappling");

  const me = wrestlerStats(actor);
  const them = wrestlerStats(target);
  const natural = await d20();
  const attack = sideResult({ thac0: me.thac0, bonus: me.strHit, targetAc: them.ac, natural });
  const base: WrestleContestFlag = {
    id: foundry.utils.randomID(), kind: "attack", initiator: me, responder: them, initiatorRoll: natural,
    rungBefore: "free", holderIsInitiator: true, state: "resolved",
  };
  if (!attack.hit) {
    await postContest({ ...base, result: { winner: "none", critical: false, initiatorTotal: attack.total, responderTotal: 0, rungAfter: "free", swap: false, lockPending: false, damage: null, unconscious: false } });
    return;
  }
  if (attack.crit) {
    // A natural 20 holds the target outright; the attacker may try for a lock next (Improve grip).
    const amount = await rollDamage(strengthDamage(me.strDmg));
    const hpBefore = target.system.attributes.hp.value; // read before the write: the update lowers it
    await writeGrapple({ id: base.id, rung: "held", locks: [], lastLock: null, pressCount: 0, lockPending: false, holder: actor, held: target, damageToHeld: amount, damageToHolder: 0, prone: false });
    await postContest({ ...base, result: { winner: "initiator", critical: true, initiatorTotal: attack.total, responderTotal: 0, rungAfter: "held", swap: false, lockPending: false, damage: { to: target.name, amount }, unconscious: temporaryDamage({ value: hpBefore, nonlethal: 0 }, amount).unconscious } });
    return;
  }
  // A plain hit: the hold check is an opposed roll the defender answers.
  const size = sizeModifier(me.size, them.size) + bodyModifier({});
  await postContest({ ...base, kind: "hold", initiatorRoll: await d20(), state: "pending", initiator: { ...me, strHit: me.strHit + size } });
}

/** Starts a follow-up contest for an existing grapple. */
export async function startContest(actor: WrestleActor, kind: Exclude<ContestKind, "attack" | "hold">): Promise<void> {
  const rules = getOptionalRules();
  if (!rules.combatAndTacticsEnabled || !rules.wrestling) return;
  if (!contestAllowed(kind, actor.statuses)) return warn("ADND2E.chat.wrestling.cannotAct");
  if (starting.has(actor.uuid)) return;
  starting.add(actor.uuid); // synchronously, before the first await
  try {
    await followUpContest(actor, kind);
  } finally {
    starting.delete(actor.uuid);
  }
}

async function followUpContest(actor: WrestleActor, kind: Exclude<ContestKind, "attack" | "hold">): Promise<void> {
  const record = myRecord(actor);
  if (!record) return warn("ADND2E.chat.wrestling.notGrappling");
  if (record.lockPending && kind !== "breakFree") return warn("ADND2E.chat.wrestling.lockPendingFirst");
  const opponent = actorOf(record.opponentUuid);
  if (!opponent) return warn("ADND2E.chat.wrestling.notGrappling");
  const holderIsInitiator = kind !== "breakFree";
  if (holderIsInitiator !== (record.role === "holder")) return warn("ADND2E.chat.wrestling.notGrappling");
  const me = wrestlerStats(actor);
  const them = wrestlerStats(opponent);
  const size = sizeModifier(me.size, them.size);
  await postContest({
    id: foundry.utils.randomID(), kind, initiator: { ...me, strHit: me.strHit + size }, responder: them, initiatorRoll: await d20(),
    rungBefore: record.rung, holderIsInitiator, state: "pending",
  });
}

/** Contest ids whose answer is in flight in this client (a double click must not answer twice). */
const answering = new Set<string>();

/** The defender's Roll defense (or the GM's Resolve for them): rolls the responder's d20, resolves, writes and posts the result. */
export async function answerContest(messageId: string): Promise<void> {
  const g = game as unknown as {
    user: { isGM: boolean };
    messages: Iterable<{ getFlag(s: string, k: string): unknown }> & { get(id: string): { getFlag(s: string, k: string): unknown } | undefined };
  };
  const flag = g.messages.get(messageId)?.getFlag(SYSTEM_ID, "wrestleContest") as WrestleContestFlag | undefined;
  if (!flag || flag.state !== "pending") return;
  const responderActor = actorOf(flag.responder.uuid);
  if (!g.user.isGM && !responderActor?.isOwner) return warn("ADND2E.chat.wrestling.notYourDefense");
  const answered = [...g.messages].some((m) => {
    const f = m.getFlag(SYSTEM_ID, "wrestleContest") as WrestleContestFlag | undefined;
    return f?.id === flag.id && f.state === "resolved";
  });
  if (answered || answering.has(flag.id)) return warn("ADND2E.chat.wrestling.alreadyAnswered");
  answering.add(flag.id); // synchronously, before the first await
  try {
    const initiatorActor = actorOf(flag.initiator.uuid);
    if (!initiatorActor || !responderActor) return;
    // Validate against the LIVE grapple so a stale or duplicate card cannot resurrect or double-apply one.
    const live = myRecord(initiatorActor);
    const valid =
      flag.kind === "hold"
        ? !live && !myRecord(responderActor)
        : live !== null && live.rung === flag.rungBefore && (live.role === "holder") === flag.holderIsInitiator;
    if (!valid) return warn("ADND2E.chat.wrestling.staleContest");
    const responderRoll = await d20();
    const opposed = resolveOpposed(
      { thac0: flag.initiator.thac0, bonus: flag.initiator.strHit, targetAc: flag.responder.ac, natural: flag.initiatorRoll },
      { thac0: flag.responder.thac0, bonus: flag.responder.strHit, targetAc: flag.initiator.ac, natural: responderRoll },
    );
    const holder = flag.holderIsInitiator ? initiatorActor : responderActor;
    const held = flag.holderIsInitiator ? responderActor : initiatorActor;
    const holderSide = flag.holderIsInitiator ? flag.initiator : flag.responder;
    const heldSide = flag.holderIsInitiator ? flag.responder : flag.initiator;
    const winnerSide = opposed.winner === "none" ? "none" : (opposed.winner === "initiator") === flag.holderIsInitiator ? "holder" : "held";
    const grip = gripOutcome({ action: flag.kind as "hold" | "improve" | "holdOn" | "breakFree", rung: flag.rungBefore, winner: winnerSide, critical: opposed.critical });
    const record = myRecord(holder) ?? myRecord(held);

    // 1d2 temporary damage to the loser side, plus the winner side's Strength damage adjustment.
    const dealerStr = grip.damageTo === "held" ? holderSide.strDmg : heldSide.strDmg;
    const dealt = grip.damageTo ? await rollDamage(strengthDamage(dealerStr)) : 0;
    // Hold on at locked repeats the previous lock effect (with press escalation).
    let repeated = 0;
    const lastLock = grip.swap ? null : record?.lastLock ?? null;
    let pressCount = grip.swap ? 0 : record?.pressCount ?? 0;
    if (grip.repeatLock && lastLock) {
      pressCount = nextPressCount(lastLock, pressCount, lastLock);
      repeated = await rollDamage(lockDamageFormula(lastLock, { pressCount, hardSurface: false, strengthAdj: holderSide.strDmg }));
    }
    // Damage by who suffers it (the OLD roles); a swap then hands the roles over below.
    const toOldHeld = (grip.damageTo === "held" ? dealt : 0) + repeated;
    const toOldHolder = grip.damageTo === "holder" ? dealt : 0;
    const damaged = toOldHeld > 0 ? held : toOldHolder > 0 ? holder : null;
    const total = toOldHeld > 0 ? toOldHeld : toOldHolder;
    const hpBefore = damaged ? damaged.system.attributes.hp.value : 0; // read before the write: the update lowers it
    // A still-pending lock survives a contest that neither swaps the roles nor drops the rung below locked.
    const lockPending = grip.lockPending || (!grip.swap && grip.rung === "locked" && (record?.lockPending ?? false));
    const newHolder = grip.swap ? held : holder;
    const newHeld = grip.swap ? holder : held;
    await writeGrapple({
      id: record?.id ?? flag.id, rung: grip.rung === "free" ? "held" : grip.rung, locks: grip.swap ? [] : record?.locks ?? [], lastLock, pressCount,
      lockPending, holder: newHolder, held: newHeld,
      damageToHeld: grip.swap ? toOldHolder : toOldHeld, damageToHolder: grip.swap ? toOldHeld : toOldHolder, prone: false, end: grip.rung === "free",
    });
    await postContest({
      ...flag, state: "resolved", responderRoll,
      result: {
        winner: opposed.winner, critical: opposed.critical, initiatorTotal: opposed.initiator.total, responderTotal: opposed.responder.total,
        rungAfter: grip.rung, swap: grip.swap, lockPending,
        damage: damaged ? { to: damaged.name, amount: total } : null,
        unconscious: damaged ? temporaryDamage({ value: hpBefore, nonlethal: 0 }, total).unconscious : false,
      },
    });
  } finally {
    answering.delete(flag.id);
  }
}

interface WriteArgs {
  id: string;
  rung: "held" | "locked";
  locks: LockEffectId[];
  lastLock: LockEffectId | null;
  pressCount: number;
  lockPending: boolean;
  holder: WrestleActor;
  held: WrestleActor;
  damageToHeld: number;
  damageToHolder: number;
  prone: boolean;
  end?: boolean;
}

/** Writes (or clears) the mirrored grapple records and any temporary damage on both actors. */
async function writeGrapple(a: WriteArgs): Promise<void> {
  const mk = (role: "holder" | "held"): GrappleRecord => {
    const opp = role === "holder" ? a.held : a.holder;
    return { id: a.id, role, opponentUuid: opp.uuid, opponentName: opp.name, rung: a.rung, locks: a.locks, lastLock: a.lastLock, pressCount: a.pressCount, lockPending: role === "holder" && a.lockPending };
  };
  const req = (target: WrestleActor, role: "holder" | "held", damage: number, prone: boolean): RelayRequest => ({
    kind: "grapple", targetUuid: target.uuid, set: a.end ? null : mk(role), damage, prone,
  });
  await requestApply(a.holder, req(a.holder, "holder", a.damageToHolder, false));
  await requestApply(a.held, req(a.held, "held", a.damageToHeld, a.prone));
}

/** The holder chooses a lock effect after winning one: applies its damage/prone/frees and records it. */
export async function chooseLock(actor: WrestleActor, lockId: LockEffectId): Promise<void> {
  const record = myRecord(actor);
  if (!record || record.role !== "holder" || !record.lockPending) return warn("ADND2E.chat.wrestling.notGrappling");
  const opponent = actorOf(record.opponentUuid);
  if (!opponent) return warn("ADND2E.chat.wrestling.notGrappling");
  const me = wrestlerStats(actor);
  const them = wrestlerStats(opponent);
  if (!canUseLock(lockId, me.size, them.size)) return warn("ADND2E.chat.wrestling.lockNotAllowed");
  const spec = LOCK_SPECS[lockId];
  const pressCount = nextPressCount(record.lastLock, record.pressCount, lockId);
  const amount = await rollDamage(lockDamageFormula(lockId, { pressCount, hardSurface: false, strengthAdj: me.strDmg }));
  const locks = Array.from(new Set<LockEffectId>([...record.locks, lockId]));
  await writeGrapple({
    id: record.id, rung: spec.dropsToHold ? "held" : "locked", locks: spec.frees ? [] : locks, lastLock: lockId, pressCount, lockPending: false,
    holder: actor, held: opponent, damageToHeld: amount, damageToHolder: 0, prone: spec.prone, end: spec.frees,
  });
  const save = spec.save ? `<p>${game.i18n!.localize(`ADND2E.chat.wrestling.lockSave.${spec.save}`)}</p>` : "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content: `<p>${game.i18n!.format("ADND2E.chat.wrestling.lockApplied", { name: foundry.utils.escapeHTML(actor.name), lock: game.i18n!.localize(`ADND2E.chat.wrestling.lock.${lockId}`) })}${amount > 0 ? ` (${amount})` : ""}</p>${save}`,
  } as never);
}

/** The holder lets go: clears the grapple on both actors. */
export async function releaseGrapple(actor: WrestleActor): Promise<void> {
  const record = myRecord(actor);
  if (!record) return warn("ADND2E.chat.wrestling.notGrappling");
  const opponent = actorOf(record.opponentUuid);
  const clear = (t: WrestleActor): RelayRequest => ({ kind: "grapple", targetUuid: t.uuid, set: null, damage: 0, prone: false });
  await requestApply(actor, clear(actor));
  if (opponent) await requestApply(opponent, clear(opponent));
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content: `<p>${game.i18n!.format("ADND2E.chat.wrestling.released", { name: foundry.utils.escapeHTML(actor.name) })}</p>`,
  } as never);
}

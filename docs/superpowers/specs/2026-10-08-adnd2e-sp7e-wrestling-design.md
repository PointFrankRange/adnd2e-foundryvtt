# Wrestling (Combat & Tactics ch.5) — design

Backlog: #93 (full Combat & Tactics maneuver list), step 1 of 4. Source: Player's Option: Combat & Tactics, "Wrestling" (pp.87-91 printed) and its worked example. Content policy: mechanical values only; no rulebook prose in the repo.

## Goal

Replace the simplified one-roll "grapple" maneuver with the book's wrestling system when a new **Wrestling** setting is on: a wrestling attack, an opposed roll to establish a hold, a ladder of grip states, seven lock effects, breaking free, and temporary (nonlethal) damage. Overbearing and pins are the next plan; brawling, pummeling, martial arts, subdual and chapter-4 options come after. Out of scope here: wrestling skill levels (everyone is *Familiar*: one wrestling attack per round, no bonuses), assistance and rescuers, wrestler-versus-wrestler mutual grabs, recovering nonlethal damage.

## Decisions (from the brainstorm)

1. **Opposed rolls: each side rolls their own.** The attacker's hit posts a pending-contest chat card; the defender's owner (or the GM) answers with **Roll defense**; the GM also gets **Resolve for them** for an absent player.
2. **Grapple state: conditions on both actors.** The defender carries the existing `held` condition, the attacker a new `grappling` condition; each stores the opponent, the status and active lock effects. Removing either from the Token HUD ends the grapple.
3. **Skill levels deferred** to the Brawling/Pummeling plan, which builds the shared unarmed-skill machinery once.
4. **Temporary damage:** wrestling damage lowers current HP *and* adds to `hp.nonlethal`; at 0 HP or below the target falls unconscious (the `unconscious` condition) instead of dying.

## Rules engine — `src/core/wrestling/` (pure, Foundry-free, 100% covered)

- **Attack roll:** d20 + attacker's usual modifiers against **AC 10**, plus the defender's Dexterity and magical protection (flat-AC effects such as bracers or shield count as +1 regardless of enchantment). A miss ends the attacker's action. A natural 20 (the system's existing critical convention) automatically holds the defender, deals 1d2, and lets the attacker try for a lock immediately.
- **Hold check (opposed roll):** both sides roll an attack against AC 10 with Dex and magic bonuses applying; Strength bonuses apply to every wrestling roll. Modifiers: +4 / -4 per size class of attacker versus defender, -1 against a defender normally immune, -2 against unusually supple bodies. The attacker needs to win:
  - both rolls hit: the **lower** roll wins;
  - exactly one hits: that side wins;
  - tie or both miss: no change (a failed first check drives the attacker back to their square and ends the grapple).
  The book's Anada-and-bugbear example is encoded as a regression test.
- **Grip ladder** (the book uses "grappled" and "held" for the same rung): `free < held < locked`.
  - *Improve grip* (opposed roll): attacker wins → defender takes 1d2 and the rung rises (held→locked); defender wins → attacker takes 1d2 (+ Str) and the rung falls (locked→held, held→free); a defender critical seizes a lock and **swaps roles**; double miss/tie → no change.
  - *Hold on* (opposed roll): defender needs a plain win to change status; no defender critical possible; held stays held (1d2), locked repeats the previous lock effect.
  - *Release* ends the grapple (attacker may act freely).
  - *Break free* (the held character's own wrestling attack): defender wins → attacker takes 1d2 + Str and the defender's rung falls; defender critical seizes a lock; attacker critical gives the attacker an automatic lock. A held character may alternatively fight with a size-S or natural weapon or pummel at -2; those routes are outside this plan (the GM clears the condition).
- **Lock effects** (chosen by the lock holder; changing effect needs a won roll): throw, takedown, slam, press (escalating +1 damage per consecutive repeat), hammer (save vs. death or unconscious), manipulate (a free-text GM-adjudicated result with 1d2 damage), carry (weight check against the PHB press value). Damage dice, size limits (cannot throw or slam a target two or more size classes larger), landing/prone results and save types come from the book table and live in one data table.
- **Damage helper:** given a dice result and target HP, returns the HP delta, the nonlethal delta and whether the target is unconscious.

## Foundry layer

- **Conditions:** add `grappling` to `src/conditions.ts` and the `conditions` pack (22 conditions; update the drift and count tests). `held` keeps its existing mechanics (cannot attack, +4 to be hit) and gains stored grapple data on its effect (`flags.adnd2e.grapple`: opponent uuid, status, lock effects, press count).
- **Wrestle action:** a PC-sheet button (shown only when the Wrestling setting and Combat & Tactics are on, with exactly one targeted token) rolls the attack, then posts the pending-contest card. While a grapple is active, a sheet panel offers the holder *Release / Improve grip / Hold on / Choose lock* and the held character *Break free*.
- **Pending contest:** a chat message carrying the attacker's roll and the context in flags. **Roll defense** (defender's owner or GM) and **Resolve for them** (GM) complete it.
- **Writes through the GM relay:** players rarely own both actors, so the resolved outcome is sent to the active GM using the existing apply relay (extended with a validated `wrestle` request kind) which performs the condition and damage writes. Pure validation in `combat/apply-relay.ts`; glue in `relay/`.
- **Setting:** `wrestling` in the Combat & Tactics section (default off, no reload). With it on, the legacy `grapple` maneuver is hidden; with it off nothing changes. Add to `OptionalRules`, the registry, `global.d.ts`, `lang`, the settings sections table and their tests.
- **Unconscious at 0 HP** uses the existing `unconscious` condition.

## Testing

- Unit: every function in `core/wrestling/`, the registry/lang/option census updates, the pure relay validation, and the worked example from the book. 100% statement coverage gate must hold.
- Headless proof (existing harness) that the new condition/flag schema survives real Foundry data validation.
- Dev-world checklist, including a non-GM player seat: attack → pending card → defender responds; GM Resolve-for-them; improve grip, hold on, release, break free and a swapped-roles critical; each lock effect; temporary damage tracked and unconscious at 0 HP; the Wrestling setting off restores the old grapple.

## Risks / open points

- A natural 20 stands in for "good enough to score a critical hit" (the system's existing critical rule); the book's own threshold is not modelled elsewhere.
- Manipulate is adjudicated by the GM; the system records it and deals the 1d2 but does not enforce its free-text effects.
- Size comes from the actor's `size` field (creatures and race items already carry one); an actor lacking one is treated as medium.

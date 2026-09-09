# `conditions` pack — source manifest

Fifteen status conditions the system ships. Each document is an `adnd2e`-subtype
ActiveEffect carrying identity only — `_id`, `name`, `img`, `statuses`, and
`system.conditionId` / `system.isCondition`. Per-condition mechanical `changes`
are deferred to SP3 / SP7; `system.changes` is `[]` here.

These docs are drift-tested against `src/conditions.ts` (`CONDITIONS`) by
`tests/conditions.test.ts` — `name` / `img` / `statuses[0]` / `system.conditionId`
must match the corresponding `CONDITIONS` row exactly. `src/system.ts` also
appends `CONDITIONS` to `CONFIG.statusEffects` in the `init` hook so the
conditions appear in the Token HUD.

No rulebook prose is stored (`system.description` is not set on these docs).

## Condition table

| id | name | img |
|----|------|-----|
| blinded | Blinded | `icons/svg/blind.svg` |
| deafened | Deafened | `icons/svg/deaf.svg` |
| prone | Prone | `icons/svg/falling.svg` |
| stunned | Stunned | `icons/svg/daze.svg` |
| unconscious | Unconscious | `icons/svg/unconscious.svg` |
| paralyzed | Paralyzed | `icons/svg/paralysis.svg` |
| poisoned | Poisoned | `icons/svg/poison.svg` |
| held | Held | `icons/svg/net.svg` |
| entangled | Entangled | `icons/svg/net.svg` |
| invisible | Invisible | `icons/svg/invisible.svg` |
| sleeping | Sleeping | `icons/svg/sleep.svg` |
| charmed | Charmed | `icons/svg/terror.svg` |
| frightened | Frightened | `icons/svg/terror.svg` |
| incapacitated | Incapacitated | `icons/svg/downgrade.svg` |
| dead | Dead | `icons/svg/skull.svg` |

All icon paths resolve under Foundry core `resources/app/public/icons/svg/`
(v14.364). `net.svg` is shared by Held / Entangled and `terror.svg` by
Charmed / Frightened — no dedicated core icon exists for those pairs.

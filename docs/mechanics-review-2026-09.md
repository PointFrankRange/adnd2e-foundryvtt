# Future mechanics — reference survey (2026-09)

Survey of the 16 sourcebooks added to `references/` on 2026-09-26 that no completed
sub-project has mined yet: *Player's Option: Spells & Magic* and the 15 "Complete
Handbook" kit/race supplements (PHBR1-15). *Combat & Tactics* and *Skills & Powers*
were added in the same batch but are excluded here — Sub-projects 7 and 8 already
cover them.

Each candidate below cites its source page range and a rough complexity (small = a
table/formula addition, medium = new UI + data model fields, large = a new
subsystem). This is a survey for backlog planning, not an implementation spec —
page numbers should be re-verified against the book when a plan is actually written.

## Tier 0 — foundational, unblocks other items

These aren't features on their own; several Tier 1/2 items depend on them.

- **Generic character-kit engine.** Every one of the 16 books is built around
  "kits" (a class or race modified by qualifications, weapon/armor/proficiency
  restrictions, special benefits/hindrances, sometimes followers). This was
  already flagged as out-of-scope for Sub-project 8. Nearly all kit content in
  this survey reduces to: restrict/grant proficiencies, restrict equipment, apply
  a stat/save/XP modifier, attach a granted power. A few kits need more than that
  bare shape — worth designing for up front:
  - **Override, not just add**: Paladin's *Ghosthunter* kit (PHBR12) replaces
    lay-on-hands/disease-immunity/spellcasting with different turning/dispel
    abilities entirely — the engine needs to support swapping base-class ability
    tables, not just bonus stacking.
  - **Parametrized granted powers**: Druid kit branches (PHBR13) each get a
    differently-scoped Shapechange (which animal categories, times/day); a
    "granted power" slot needs parameters, not a flat flag.
  - **Bespoke mini-mechanics**: Fighter's *Wizard Slayer* (bypasses
    nonmagical-weapon immunity), Ranger's *Giant Killer* (a taunt-and-worsen-save
    combat trick), Thief's *Buccaneer* (a rope-balance minigame) — these need a
    "grants a situational combat rule" hook, not pure data.
  - **Grants a sub-class feature outright**: Priest's "Granted Powers" framework
    (PHBR3 pp.23-27) is itself a structured 3-tier (High/Medium/Low) toolkit for
    building a priesthood's signature ability (charm N/day, elemental immunity,
    shapechange, incite rage, lay on hands, prophecy, detection) — this could
    double as the kit engine's own granted-power library. Ninja's *Spirit Warrior*
    kit (PHBR15) grants a full spellcasting progression on its own table.
- **Generic subrace architecture.** Dwarves (×6), elves (×7), gnomes (×4), and
  halflings (×4) each get named subraces (duergar, drow, svirfneblin, etc.) with
  their own ability-score range, infravision, and XP-cost surcharge layered over
  the base race. The current data model has one race = one set of adjustments;
  none of the specific subrace packages below (drow, duergar, deep gnome) can be
  built until this exists. Medium complexity — a data-model change, not new rules
  logic.
- **XP-multiplier / "level adjustment" for powerful races.** PHBR10 (Humanoids),
  Ch.1 pp.8-9 + per-race entries. Every playable monstrous race carries a flat %
  or ×N surcharge on XP needed per level (e.g. ogre magi need 2× XP/level); an
  optional rule lets any race exceed its level cap at a steeper 2-4× surcharge.
  Medium complexity (one multiplier field touching XP-award and level-up code) —
  reusable for any future race, kit, or homebrew.
- **Turn Undead (base mechanic).** Confirmed still completely unimplemented — not
  reprinted in any of these supplements (it lives in core PHB/DMG, which the
  agents didn't have new access to). Referenced as a dependency by Paladin
  (turns 2 levels lower than actual level — PHBR12 Table 10, p.8), Shaman (turns
  from 3rd level at -2 effective levels, gated on holding a consumable talisman —
  PHBR14 p.11-13), and Priest kits (Granted Powers can reference it). Confirmed
  Druids explicitly have **no** Turn Undead ability at all (PHBR13) — useful for
  correctly gating the eventual implementation to Cleric-type priests only.

## Tier 1 — high-value standalone subsystems (candidate for a full sub-project each)

- **Spell Points & Channellers** — *Spells & Magic* pp.76-83, Tables 17-21.
  Replaces standard memorization: SP pool by class/level, spells memorized as
  cheap "fixed magick" (locked to one spell) or pricier "free magick" (any spell
  of that level); optional add-ons for exceeding spell-level limits, overcharging
  for greater effect, or discounting for reduced power/longer cast time/narrow
  conditions. Channellers spend SP per-cast instead of losing a memorized spell,
  but take escalating **fatigue** (5 tiers, Table 21, with real combat penalties —
  movement/to-hit/AC) each cast, recovered via a rest-rate table (Table 20).
  Large. **Flagship pick**: the `OptionalRules` toggle framework already has a
  stub for this ("not implemented" hint), and it's the most-requested 2E
  alternate-magic system.
- **Psionics** — PHBR5, entire book, Chs.1-8. Currently zero implementation.
  Core loop: a PSP pool + "power score" (Wis/Int/Con-derived, structurally
  parallel to the existing proficiency-check pattern) spent via power checks
  (d20 ≤ score); disciplines/sciences/devotions learned per a progression table
  with real constraints (devotions ≥ 2× sciences per discipline); **psionic
  combat** (pp.22-27) is a self-contained mini combat system — attack modes vs.
  defense modes resolved as psychic contests via a 5×5 modifier matrix, with
  "tangent"/"full contact" state tracking, closely paralleling the crit/called-shot
  work already shipped in Sub-project 7. **Wild Talents** (pp.18-19) let any
  class roll a one-off minor psionic power without full class buy-in — a cheap,
  self-contained entry point once the PSP model exists. Recommend splitting into
  several plans (chassis + PSP model / psionic combat / wild talents / the
  100+-power discipline catalog) rather than one — this is the single largest
  system in the whole survey.
- **Druid Shapechanging** — PHBR13, Druid Characters ch., pp.6-8. Real numeric
  limits: 1 full round to shift, heals 1d6×10% of current damage on assuming a
  new form, keeps original HP/saves but takes the animal's AC/movement/attacks/
  damage; frequency and available forms are branch-specific (base branch: 3/day,
  gained 7th level). Large, but directly extends the already-implemented core
  Druid class — the strongest single finding in the Priest/Druid pair.
- **Barbarian class + Wild Fighting (rage)** — PHBR14, Ch.1 pp.7-11 (class core),
  pp.78-79 (Wild Fighting). Non-metal-armor-only class with its own two-weapon
  penalty table and built-in thief-like abilities (leaping, back-attack
  detection, climbing). Wild Fighting is the actual "rage" analog: a pre-combat
  proficiency check triggers +1 attack/round, +3 damage, -3 AC for up to an hour,
  once per hour of rest. Medium (Wild Fighting alone) to large (full class).
- **Ninja Martial Arts / Ch'i Attacks** — PHBR15, Ch.4, pp.39-61. Unarmed-combat
  styles built from selectable principal methods (Strike/Kick/Throw/Lock/
  Vital-Area/Weapon) with named special maneuvers resolved via attack-roll +
  hit-location + severity tables (Choke Hold, Distance Death, Steel Cloth,
  Ironskin, etc.); Ch'i Attacks make unarmed hits count as magical weapons by
  level for bypassing damage resistance. Large — a full parallel to the
  already-shipped weapon crit/mastery-tier system, just for unarmed combat.
- **Paladin Bonded Mount** — PHBR12 pp.17-19, Table 13. A real generation
  procedure (d100 species table gated by paladin level, DM-restricted HD caps,
  boosted Int/Morale over species baseline, full stat block for the default war
  horse). Large, but turns a currently hand-waved feature into something
  generatable.
- **Ranger Tracking** — PHBR11 pp.13-16, Tables 15-19. Wisdom-based score
  modified by terrain/illumination/situational tables, capped movement while
  tracking, loss/re-check conditions, and a secondary "Identification check" that
  scales quarry detail by ranger level. Medium-large, fully formula-driven — the
  strongest single find in the Ranger/Paladin pair, ideal for a roll-dialog +
  modifier-stack treatment.

## Tier 2 — strong additions to existing systems

- **Signature Spells** (*Spells & Magic* pp.57-58, Table 9) — a wizard
  spell-specialization system structurally identical to the fighter weapon-spec
  work already shipped (PR #43): spend slots/CP to master one spell per level
  ever known, cast it at +2 effective levels or with a save/casting-time
  discount, plus a free extra daily memorization. Medium — near-zero design risk
  since the analogous data model already exists.
- **Priest Spell Points + Minor Spheres/Orisons** (*S&M* pp.91-93, Tables 26-29)
  and **Ritual Prayer** (pp.94-95, multi-round SP-gathering with an initiative
  penalty, reusing the existing Begin→Complete casting flow) and **Conditional
  Magic** (pp.96-97, deity-condition-gated bonus/penalty casting — more
  GM-adjudicated, better as an assisted calculator than full automation).
  Medium each.
- **Expanded Melee Maneuvers** (PHBR1 pp.64-79) — a second maneuver list beyond
  Combat & Tactics's curated 4 (Hold Attack, Parry, Pin, Sap, Shield-Punch,
  Shield-Rush, Grab, expert Disarm), each with a barehanded variant. Large,
  directly extends the "full maneuver list" backlog item.
- **Fighting Style Specialization** (PHBR1 pp.61-64) — a proficiency-slot sink
  separate from weapon specialization (Single-Weapon/Two-Hander/
  Weapon-and-Shield/Two-Weapon), stacking with the existing 4-tier mastery
  system. Large.
- **Weapon-Group Proficiency** (PHBR1 pp.58-60) — buy proficiency for a whole
  weapon group (Tight = 2 slots, Broad = 3) instead of one weapon at a time.
  Medium, mostly data (weapon taxonomy).
- **Hit Locations / Called-Shot body system** (PHBR1 pp.79-81) — gives called
  shots a real mechanical payoff (Numbed/Useless thresholds disable a body part)
  instead of just an attack-roll penalty. Large.
- **Bard package** (PHBR7): **Influence Reactions** (pp.16-17, grouped saves vs.
  paralyzation to shift NPC reaction), **Counter Song** (pp.17/57, cancels
  sound-based effects in a radius), **Rally Allies** (pp.16-17, timed party buff
  reusing existing ActiveEffect patterns from Sub-project 7), **Legend Lore**
  (pp.17-18, a percentile+table item-knowledge check), and a **Reputation
  ladder** (pp.102-105, per-city standing that doubles Influence Reactions on a
  successful check). Medium each; the signature bard mechanics currently have
  zero implementation.
- **Paladin core abilities with real numbers** (PHBR12 pp.10-15) — Laying on
  Hands (2×level HP, 1/day), Aura of Protection (10-ft, -1 to-hit for evil
  attackers, caps with protection-from-evil), Detect Evil Intent (range/area/
  material-blocking rules + a reusable 4-tier intensity signal), disease
  immunity/cure schedule. Medium, mostly per-day-tracked formulas.
- **Ranger Animal Empathy** (PHBR11 pp.21-24) — save-vs-rods with a
  level-scaling penalty to shift an animal's attitude on a 6-tier ladder; reuses
  existing saving-throw infrastructure. Small-medium. **Two-weapon fighting
  without penalty** (PHBR11 p.9) — a conditional override (light armor, no
  shield) of the existing dual-wield penalty calc. Small.
- **Racial combat bonuses vs. creature types + underground detection**
  (PHBR6/PHBR9) — dwarves +1 to-hit vs. orc-kin / enemies -4 vs. dwarves; small
  races get an AC bonus vs. "giant class" attackers; innate no-slot checks for
  slope/new-construction/unsafe-stonework/depth/direction underground. Small to
  medium, needs a creature-type tag on actors.
- **Advanced Locks & Traps** and **expanded poison rules** (PHBR2 pp.111-113) —
  per-lock/trap %-modifiers, a Locksmithing-driven "build a superior lock"
  procedure, non-lethal sedatives, poison gas, and a timed antidote procedure via
  Herbalism. Medium, gives currently-flavor proficiencies real teeth.
- **Ninja thieving-skill progression + backstab variant** (PHBR15 pp.6-7,
  Tables 2-4) — a second skill-point engine (own base%, own per-level pool,
  same 95% cap) and its own backstab multiplier curve (×2 at 1-4 up to ×5 at
  13+). Medium/small — mostly a data table swap on existing plumbing.

## Tier 3 — niche, lower automation value, or best folded into existing systems

- **Warlocks/Witches, Defilers/Preservers, Alienist insanity** (*S&M* pp.83-87)
  — alternate spell-point casters with corruption/environmental-damage/insanity
  risk mechanics. Large each; niche unless a specific campaign wants them.
- **Spell Research & Magic Item Creation** (*S&M* pp.101-115) — real formulas
  (success%, cost, duration) for both; currently no such subsystem exists at
  all. Large, worth a dedicated future plan if item/spell crafting is ever
  wanted.
- **Casting Subtlety/Sensory Signature, Armor-Breaching vs. Armor-Observing
  spells, Spell Knockdowns** (*S&M* pp.117-124) — small, cheap formula/table
  additions that plug into existing casting and AC math; good candidates to
  bundle into one "spell-combat polish" plan alongside Signature Spells.
- **Spell-specific Critical Strikes** (*S&M* pp.124-129) — a second, parallel
  crit system keyed to damage type. Recommend folding into the existing
  crit/fumble severity tables as a "spell source" flag rather than building
  parallel infrastructure.
- **Fighting-Monk Martial Arts** (PHBR3 pp.124-127) — a roll-to-maneuver lookup
  table scoped to one priest kit; conceptually overlaps the already-shipped
  Combat & Tactics maneuver system.
- **Drow, Duergar, Deep Gnome subrace packages** (PHBR8 pp.79-80, PHBR6 p.30,
  PHBR9 p.25) — complete but large (magic resistance scaling, innate
  spell-likes, bespoke stealth/surprise models). Worth building only once the
  Tier 0 subrace architecture exists and if these subraces are wanted as PCs.
- **Hierophant epic Druid progression** (PHBR13 pp.119-122) — world-population-gated
  (a handful of NPCs per setting), rarely reached in play.
- **Jousting & Lance Specialization** (PHBR1 pp.85-86) — a bounded mounted-combat
  mini-system; the project doesn't touch mounted combat at all today.
- **Followers/Believers systems** (Priest pp.28-31, Ranger pp.26-38) — mostly
  DM-adjudicated downtime content with low automation payoff.
- **Magic item malfunction** (PHBR6 p.34) — a per-use roll for dwarves using
  non-dwarf-made magic items. Small, but niche.
- **Danger Sense** (PHBR14 p.74) — a hidden pre-ambush check granting a warning
  + auto-initiative-win. Trivial, easy pickup if ever revisiting the barbarian
  book.
- **Monster/humanoid PC natural-attack engine** (PHBR10) — flight, natural
  weapons, innate spell-likes for playable monstrous races (aarakocra, ogre
  magi, lizard man, etc.). The real prerequisite here is generic "natural
  attack / natural AC / innate spell-like" building blocks for PC actors, not
  any one race's flavor.

## Notable non-findings

- *Spells & Magic*'s highest table number is 48 — no Table 56 exists in this
  book, so the "Table 56 innate-ability/magic-item initiative modifiers" gap
  noted in the README likely points to a different sourcebook, not this one.
- No spell-mishap or wild-magic table in *Spells & Magic* — it explicitly defers
  wild magic to *Tome of Magic*, which isn't in `references/`.
- No dedicated bard "fascinate" ability and no bard-specific spell-progression
  table beyond the standard PHB one already implemented.

## Suggested next step

Given the existing `OptionalRules` stub, the Spells & Magic **spell points /
channellers** system (Tier 1) is the most natural next sub-project — it closes a
gap the system already advertises as coming. **Psionics** is the largest
standalone opportunity (currently zero coverage) but big enough to warrant its
own multi-plan sub-project. Building the **generic kit engine** (Tier 0) earlier
rather than later would unlock a large fraction of the Tier 2/3 items across
every class and race book at once, so it's worth weighing against jumping
straight to a flagship feature.

# Priest channelling and orisons — Design

Date: 2026-10-04. Source: Player's Option: Spells & Magic, Chapter 6 (printed pp. 91–93, Orisons; Appendix 1 orison list). Builds on Plan A (wizard spell points), Plan B (channellers), Plan C (fatigue), and Plan D (priest spell points, PR #57).

Delivered as two PRs so each can be tested on its own: PR 1 orisons, PR 2 priest channelling.

## Approved decisions

- Orisons are built under the spell-points rule only. The PHB slot-based orison rule is out of scope.
- Priest channelling uses the existing Channellers toggle. The book says the channelling rules apply to priests exactly as they do to wizards.
- Orisons are stored as level-0 priest spell items.

## PR 1: orisons under the spell-points rule

**Data**
- The spell item schema accepts level 0 for `casterClass: "priest"` only. Level 0 for wizards stays rejected, as cantrips are today.

**Cost**
- Each orison costs 1 SP, priced as a universal free theurgy (Table 28/29 orison entry = 1).
- While memorized, its SP stays tied up, as for other free theurgies. Casting expends the entry until rest, as for other memorized spells.

**Cap**
- A priest can hold up to twice the Table 26 max spells per level for their priest level. A 3rd-level priest holds 10.
- The cap counts memorized orisons only; it does not share the per-level cap for ordinary spells.

**Sheet**
- Known Spells lists orisons under an "Orisons" heading.
- Orisons appear only when the spell-points rule is on. With the rule off, they are not offered for memorize.

**Testing**
- Pure tests: the cap formula at several priest levels, the 1-SP cost, and the pool check.
- Dev-world: memorize orisons up to the cap, check the SP tie-up, cast one, rest, and confirm the cap refuses an extra one.

## PR 2: priest channelling under the Channellers toggle

**Who**
- Clerics and druids only (the chassis with a priest spell pool). Paladins and rangers keep classic slots, as built in Plan D.

**Pool**
- The max is the priest spell-point total: Table 26 plus the Wisdom bonus, adjusted by the Constitution hit-point adjustment, with the book's rule that an adjustment dropping the total below 4 is ignored. This is the same formula as the Plan D priest total.
- The pool is persisted and recovers under Table 20, as for wizard channellers.

**Spending**
- Each cast spends SP at the Table 28/29 cost for its scope and type (fixed or free), through the existing channelling spend path.
- Memorizing costs nothing from the pool; the Table 26 caps still apply, as for wizard channellers.
- Orisons under channelling cost 1 SP per cast from the pool, and memorizing them is free.

**Fatigue**
- Table 21 fatigue applies to channelled priest casts, using the same resolution path as wizard channellers.

**Not included**
- Exceeding the spell-level limit, which remains an open backlog item for wizard channellers too.

## Testing

- Pure tests: the priest channelling max (with Constitution and the 4-SP rule), the cost per cast, and recovery.
- Dev-world: a cleric with channelling on casts a fixed theurgy and a free theurgy, watches the pool drop, recovers after a rest, and reaches fatigue on a heavy cast.

# `core/` — framework-free rules engine

Every file here is pure TypeScript: no imports from `foundry`, `game`, `CONFIG`,
the DOM, or any Foundry API. Functions take all inputs explicitly (including an
`OptionalRules` bag for anything a house rule changes) and return plain data or
dice-formula **strings** — never a Foundry `Roll`.

The Foundry `data/` layer calls into this engine from `prepareDerivedData`.
Unit-tested with Vitest under `tests/core/`. Lint enforces the no-Foundry rule.

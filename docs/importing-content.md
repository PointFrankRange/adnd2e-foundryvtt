# Importing Content

## Purpose

`game.system.api.importContent(json)` lets a GM bulk-create Items and Actors from a JSON file — the intended path for content the GM has transcribed from books they own (spell text, monster stat blocks, magic items). The system itself ships only mechanical class/race/proficiency data; it ships no rulebook prose, and this importer is how you add your own.

## Calling It

GM-only, from the browser console or a macro:

```js
const result = await game.system.api.importContent(myJson, { folderName: "My Homebrew" });
console.log(result); // { created: [...], failed: [...], folders: {...} }
```

`folderName` is optional (default `"Imported Content"`). Documents are created in a world folder of the matching type, created if it does not exist.

## The JSON Envelope

A single object with a `documents` array:

```json
{
  "documents": [
    {
      "documentType": "Item",
      "type": "spell",
      "name": "Magic Missile",
      "img": "icons/svg/explosion.svg",
      "system": { "level": 1, "school": "invocation" }
    },
    {
      "documentType": "Actor",
      "type": "creature",
      "name": "Giant Rat",
      "system": { "hd": { "count": 1, "dieType": 8, "bonus": 0 } }
    }
  ]
}
```

- `documentType` — `"Item"` or `"Actor"` (required).
- `type` — an Item or Actor subtype (required). Item subtypes: `class`, `race`, `weapon`, `armor`, `equipment`, `spell`, `weaponProficiency`, `nonweaponProficiency`, `classFeature`. Actor subtypes: `character`, `npc`, `creature`.
- `name` — required, non-empty.
- `img` — optional icon path.
- `system` — optional; the subtype's `system` fields. Fields you omit take their schema defaults. The authoritative field list for each subtype is its DataModel: `src/data/item/<subtype>.ts` and `src/data/actor/<subtype>.ts` in this repo.

## What You Get Back

```js
{
  created: [
    { id: "abc123", name: "Magic Missile", type: "spell", documentType: "Item" }
  ],
  failed: [
    { index: 1, name: "Giant Rat", error: "unknown Actor subtype \"monster\"" }
  ],
  folders: {
    Item: "folder-id-1",
    Actor: "folder-id-2"
  }
}
```

- `created` — array of successfully created documents, each with `id`, `name`, `type`, and `documentType`.
- `failed` — array of documents that could not be created, each with the input `index` (into the `documents` array), the attempted `name`, and an `error` message.
- `folders` — IDs of the world folders created (or reused), keyed by document type. Only present for document types that were imported.

Each document is created independently — one document with a bad `system` field lands in `failed` with the validation error, and the rest still import. A notification summarizes the run; failures are also logged to the console.

## Limitations (This Release)

- **Create-only** — importing the same file twice makes duplicate documents; there is no update-by-id or dedup.
- **No compendium target** — documents go to a world folder; move them into a compendium yourself afterward.
- **No folder hierarchy / adventure bundles** — all documents land in a single folder.

These are planned for a later release.

## Content Policy

Only import content you have the right to use — your own transcriptions from books you own, or freely-licensed material. Do not share worlds or exports containing copyrighted rulebook text.

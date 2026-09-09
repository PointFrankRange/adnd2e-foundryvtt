// Compile every packs/<name>/_source into a Foundry v14 LevelDB pack under
// dist/packs/<name>. Runs after `vite build` (which empties dist/ and copies the
// static assets), so we only add the packs.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(root, "system.json"), "utf8"));
const packs = manifest.packs ?? [];

if (packs.length === 0) {
  console.log("build-packs: system.json declares no packs — nothing to do.");
  process.exit(0);
}

for (const pack of packs) {
  const src = path.join(root, "packs", pack.name, "_source");
  const dest = path.join(root, "dist", "packs", pack.name);
  console.log(`build-packs: ${pack.name}  ${src} -> ${dest}`);
  await compilePack(src, dest, { log: true, recursive: false });

  // Guard: every JSON source doc must land as a key in the compiled LevelDB.
  // The CLI silently `continue`s past any doc missing `_key`, so a count
  // mismatch (or an empty pack) must fail the build loudly. `_MANIFEST.md` and
  // any other non-`.json` file is not a pack doc.
  const expected = readdirSync(src).filter((f) => f.endsWith(".json")).length;
  const db = new ClassicLevel(dest, { valueEncoding: "json" });
  let actual;
  try {
    actual = (await db.keys().all()).length;
  } finally {
    await db.close();
  }
  if (actual !== expected) {
    throw new Error(
      `build-packs: pack "${pack.name}" compiled ${actual} document(s) but ${expected} JSON source file(s) exist in ${src} — every source doc needs a "_key" field (see scripts/build-packs.mjs guard).`,
    );
  }
  console.log(`build-packs: ${pack.name}  ${actual}/${expected} documents OK`);
}
console.log(`build-packs: compiled ${packs.length} pack(s).`);

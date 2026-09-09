// Compile every packs/<name>/_source into a Foundry v14 LevelDB pack under
// dist/packs/<name>. Runs after `vite build` (which empties dist/ and copies the
// static assets), so we only add the packs.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

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
}
console.log(`build-packs: compiled ${packs.length} pack(s).`);

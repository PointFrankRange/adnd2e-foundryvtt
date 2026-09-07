#!/usr/bin/env node
// Stamp dist/system.json for a release. Run in CI after `npm run build`.
//   tag push  (GITHUB_REF = refs/tags/vX.Y.Z) -> version = X.Y.Z, assets under v${version}
//   any other push                            -> version = 0.1.0-dev.<run number>, assets under `latest`
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = process.env.GITHUB_REPOSITORY ?? "PointFrankRange/adnd2e-foundryvtt";
const BASE = `https://github.com/${REPO}`;

const ref = process.env.GITHUB_REF ?? "";
const runNumber = process.env.GITHUB_RUN_NUMBER ?? "0";
const tagMatch = ref.match(/^refs\/tags\/v(.+)$/);
const version = tagMatch ? tagMatch[1] : `0.1.0-dev.${runNumber}`;

const channel = tagMatch ? `download/v${version}` : "download/latest";

const path = resolve("dist/system.json");
const manifest = JSON.parse(readFileSync(path, "utf-8"));
manifest.version = version;
manifest.manifest = `${BASE}/releases/${channel}/system.json`;
manifest.download = `${BASE}/releases/${channel}/system.zip`;
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`prepared dist/system.json: version=${version}`);

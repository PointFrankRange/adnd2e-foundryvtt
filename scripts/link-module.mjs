#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";

const configPath = resolve("foundryconfig.json");
if (!existsSync(configPath)) {
  console.error(
    "Missing foundryconfig.json. Copy foundryconfig.example.json to foundryconfig.json and set your Foundry data path.",
  );
  process.exit(1);
}

const { dataPath } = JSON.parse(readFileSync(configPath, "utf-8"));
const { id: moduleId } = JSON.parse(readFileSync(resolve("module.json"), "utf-8"));

const target = resolve("dist");
if (!existsSync(target)) {
  console.error(`Build output not found at ${target}. Run "npm run build" first.`);
  process.exit(1);
}

const modulesDir = join(dataPath, "Data", "modules");
mkdirSync(modulesDir, { recursive: true });

const linkDir = join(modulesDir, moduleId);
if (existsSync(linkDir)) {
  rmSync(linkDir, { recursive: true, force: true });
}

// "junction" works on Windows without admin privileges and is a no-op type on POSIX.
symlinkSync(target, linkDir, "junction");
console.log(`Linked ${target} -> ${linkDir}`);

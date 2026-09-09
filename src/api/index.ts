// Assembles the object exposed as `game.system.api` (spec §7, §12.10). Wired in
// `src/system.ts` on `ready`.
import { importContent } from "./import-content";

export function buildApi() {
  return { importContent };
}

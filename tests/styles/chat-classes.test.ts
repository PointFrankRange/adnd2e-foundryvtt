import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const CHAT_DIR = path.join(ROOT, "templates", "chat");
const CSS = readFileSync(path.join(ROOT, "styles", "chat", "_chat.scss"), "utf8");
const SYSTEM = readFileSync(path.join(ROOT, "styles", "system.scss"), "utf8");

/** Class tokens used by a chat template, after stripping every Handlebars expression. */
function classTokens(source: string): { root: string[]; rest: string[] } {
  const stripped = source.replace(/\{\{[^}]*\}\}/g, " ");
  const attrs = [...stripped.matchAll(/class="([^"]*)"/g)].map((m) => m[1]!.split(/\s+/).filter(Boolean));
  const [first = [], ...others] = attrs;
  return { root: first, rest: others.flat() };
}

/** Plain paragraphs and labels that deliberately carry no rule of their own (they inherit the card ink). */
const NO_RULE = new Set(["check", "powers", "maneuver", "name", "chance"]);

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("chat card stylesheet (#150)", () => {
  it("styles every turn-undead status", () => {
    for (const s of ["notUndead", "untagged", "cannot", "fail", "turned", "destroyed", "unaffected"]) {
      expect(CSS, `.status-${s}`).toMatch(new RegExp("\\.status-" + s + "(?![\\w-])"));
    }
  });

  it("is loaded from system.scss", () => {
    expect(SYSTEM).toContain("chat/chat");
  });

  const files = readdirSync(CHAT_DIR).filter((f) => f.endsWith(".hbs"));
  it("finds all fifteen chat templates", () => {
    expect(files.length).toBe(15);
  });

  for (const file of files) {
    it(`every class used by ${file} has a rule in _chat.scss (or is a documented plain label)`, () => {
      const { root, rest } = classTokens(readFileSync(path.join(CHAT_DIR, file), "utf8"));
      expect(root).toContain("chat-card");
      // the root's own card-name token (e.g. "attack-roll") needs no rule; a root modifier such as "lost" does
      const rootModifiers = root.filter((t) => !["adnd2e", "chat-card"].includes(t)).slice(1);
      for (const token of [...rootModifiers, ...rest]) {
        if (NO_RULE.has(token)) continue;
        const re = token.endsWith("-")
          ? new RegExp("\\." + esc(token) + "\\w")
          : new RegExp("\\." + esc(token) + "(?![\\w-])");
        expect(CSS, `${file}: .${token}`).toMatch(re);
      }
    });
  }

  it("defines the colour tokens for both themes", () => {
    expect(CSS).toContain(".adnd2e.chat-card");
    expect(CSS).toMatch(/body\.theme-dark \.adnd2e\.chat-card/);
    for (const t of ["--chat-bg", "--chat-head", "--chat-hit", "--chat-miss", "--chat-crit", "--chat-fumble"]) {
      expect(CSS, t).toContain(t);
    }
  });

  it("never uses core's bare .disabled class", () => {
    expect(CSS).not.toMatch(/\.disabled\b/);
  });
});

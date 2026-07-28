import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getAllAgents as getClaudeAgents } from "../../src/templates/claude/index.js";
import { getAllAgents as getCursorAgents } from "../../src/templates/cursor/index.js";
import { getAllAgents as getCodexAgents } from "../../src/templates/codex/index.js";
import { getAllAgents as getKiroAgents } from "../../src/templates/kiro/index.js";
import { getAllAgents as getGeminiAgents } from "../../src/templates/gemini/index.js";
import { getAllAgents as getQoderAgents } from "../../src/templates/qoder/index.js";
import { getAllAgents as getCodeBuddyAgents } from "../../src/templates/codebuddy/index.js";
import { getAllDroids } from "../../src/templates/droid/index.js";
import { getAllAgents as getPiAgents } from "../../src/templates/pi/index.js";
import { collectOpenCodeTemplates } from "../../src/configurators/opencode.js";
import { collectPlatformTemplates } from "../../src/configurators/index.js";

const templatesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/templates",
);
const readers = [
  ["claude", "agents", "md", getClaudeAgents],
  ["cursor", "agents", "md", getCursorAgents],
  ["codex", "agents", "toml", getCodexAgents],
  ["kiro", "agents", "json", getKiroAgents],
  ["gemini", "agents", "md", getGeminiAgents],
  ["qoder", "agents", "md", getQoderAgents],
  ["codebuddy", "agents", "md", getCodeBuddyAgents],
  ["droid", "droids", "md", getAllDroids],
  ["pi", "agents", "md", getPiAgents],
] as const;

function canonicalAgentNames(
  platform: string,
  subdir: string,
  extension: string,
): string[] {
  return fs
    .readdirSync(path.join(templatesRoot, platform, subdir))
    .filter(
      (file) =>
        file.endsWith(`.${extension}`) && !file.endsWith(`.zh.${extension}`),
    )
    .map((file) => file.slice(0, -`.${extension}`.length))
    .sort();
}

describe("locale-aware agent template readers", () => {
  for (const [platform, subdir, extension, read] of readers) {
    it(`${platform} keeps the English-canonical logical set and locale-isolated caches`, () => {
      const expectedNames = canonicalAgentNames(platform, subdir, extension);
      const englishBefore = read("en");
      const chinese = read("zh");
      const englishAfter = read("en");

      expect(expectedNames.length, platform).toBeGreaterThan(0);
      expect(englishBefore.map(({ name }) => name).sort(), platform).toEqual(
        expectedNames,
      );
      expect(englishAfter).toEqual(englishBefore);
      expect(chinese.map(({ name }) => name).sort()).toEqual(expectedNames);
      expect(chinese.every(({ name }) => !name.includes(".zh"))).toBe(true);
      for (const localized of chinese) {
        const sibling = path.join(
          templatesRoot,
          platform,
          subdir,
          `${localized.name}.zh.${extension}`,
        );
        const canonical = englishBefore.find(
          ({ name }) => name === localized.name,
        );
        if (fs.existsSync(sibling)) {
          expect(localized.content, sibling).toMatch(/[\u3400-\u9fff]/);
        } else {
          expect(localized.content, localized.name).toBe(canonical?.content);
        }
      }
    });
  }

  it("Copilot derives localized definitions from Cursor without physical sidecars", () => {
    const english = collectPlatformTemplates("copilot", "en");
    const chinese = collectPlatformTemplates("copilot", "zh");
    if (!english || !chinese) throw new Error("Missing Copilot templates");
    const englishAgents = [...english]
      .filter(([file]) => file.startsWith(".github/agents/"))
      .sort(([left], [right]) => left.localeCompare(right));
    const chineseAgents = [...chinese]
      .filter(([file]) => file.startsWith(".github/agents/"))
      .sort(([left], [right]) => left.localeCompare(right));

    expect(englishAgents.length).toBeGreaterThan(0);
    expect(chineseAgents.map(([file]) => file)).toEqual(
      englishAgents.map(([file]) => file),
    );
    expect(chineseAgents.every(([file]) => !file.includes(".zh."))).toBe(true);
    expect(
      chineseAgents.every(([, content]) => /[\u3400-\u9fff]/.test(content)),
    ).toBe(true);
  });

  it("OpenCode collection selects localized agents without leaking sidecars", () => {
    const englishBefore = collectOpenCodeTemplates("en");
    const chinese = collectOpenCodeTemplates("zh");
    const englishAfter = collectOpenCodeTemplates("en");
    const agentEntries = (files: Map<string, string>) =>
      [...files]
        .filter(([file]) => file.startsWith(".opencode/agents/"))
        .sort(([left], [right]) => left.localeCompare(right));
    const englishAgents = agentEntries(englishBefore);
    const chineseAgents = agentEntries(chinese);

    expect(englishAfter).toEqual(englishBefore);
    expect(englishAgents.length).toBeGreaterThan(0);
    expect(chineseAgents.map(([file]) => file)).toEqual(
      englishAgents.map(([file]) => file),
    );
    expect(chineseAgents.every(([file]) => !file.includes(".zh."))).toBe(true);
    expect(
      chineseAgents.every(([, content]) => /[\u3400-\u9fff]/.test(content)),
    ).toBe(true);
  });
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PLATFORM_IDS,
  collectPlatformTemplates,
  configurePlatform,
} from "../../src/configurators/index.js";

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("localized platform configurators", () => {
  const localizedPlatforms = new Set([
    "claude-code",
    "cursor",
    "opencode",
    "codex",
    "kilo",
    "kiro",
    "gemini",
    "antigravity",
    "devin",
    "qoder",
    "codebuddy",
    "copilot",
    "droid",
    "pi",
    "trae",
  ]);

  it.each(["en", "zh"] as const)(
    "Codex and Gemini share byte-identical Agent Skills under %s",
    (language) => {
      const codex = collectPlatformTemplates("codex", language);
      const gemini = collectPlatformTemplates("gemini", language);
      if (!codex || !gemini) throw new Error("Missing shared-skill templates");

      const sharedGemini = [...gemini].filter(([file]) =>
        file.startsWith(".agents/skills/"),
      );
      expect(sharedGemini.length).toBeGreaterThan(0);
      for (const [file, content] of sharedGemini) {
        expect(codex.get(file), `${language}:${file}`).toBe(content);
      }
    },
  );

  for (const platform of PLATFORM_IDS) {
    it(`${platform} keeps paths stable across en -> zh -> en collection`, () => {
      const englishBefore = collectPlatformTemplates(platform, "en");
      const chinese = collectPlatformTemplates(platform, "zh");
      const englishAfter = collectPlatformTemplates(platform, "en");

      expect(englishBefore, platform).toBeDefined();
      expect(chinese, platform).toBeDefined();
      if (!englishBefore || !chinese) {
        throw new Error(`Missing template collection for ${platform}`);
      }
      expect(englishAfter).toEqual(englishBefore);
      const englishPaths = [...englishBefore.keys()].sort();
      const chinesePaths = [...chinese.keys()].sort();
      expect(chinesePaths).toEqual(englishPaths);
      expect(chinesePaths.every((file) => !file.includes(".zh."))).toBe(true);
      if (localizedPlatforms.has(platform)) {
        expect(
          chinesePaths.some(
            (file) => chinese.get(file) !== englishBefore.get(file),
          ),
        ).toBe(true);
        expect(
          [...chinese.values()].some((content) =>
            /[\u3400-\u9fff]/.test(content),
          ),
        ).toBe(true);
      }
    });

    for (const language of ["en", "zh"] as const) {
      it(`${platform} ${language} init bytes match update collection`, async () => {
        const cwd = fs.mkdtempSync(
          path.join(os.tmpdir(), `trellis-${platform}-${language}-`),
        );
        temporaryDirectories.push(cwd);
        await configurePlatform(platform, cwd, language);
        const collected = collectPlatformTemplates(platform, language);
        expect(collected, platform).toBeDefined();
        if (!collected) throw new Error(`Missing collection for ${platform}`);

        for (const [file, expected] of collected) {
          const target = path.join(cwd, file);
          expect(fs.existsSync(target), `${platform}:${language}:${file}`).toBe(
            true,
          );
          expect(fs.readFileSync(target, "utf-8"), file).toBe(expected);
        }
      });
    }
  }
});

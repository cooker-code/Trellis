import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CJK_RE,
  expectCompleteChineseMarkdown,
  expectLocalizedChineseProse,
} from "./i18n-completeness.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/templates",
);

interface CanonicalAgentSource {
  platform: string;
  extension: "md" | "toml" | "json";
  englishPath: string;
  chinesePath: string;
  relativePath: string;
}

// PR2's explicit physical-source scope. Newer platforms fall back to their
// canonical English agent files until a dedicated localization slice adds
// reviewed Chinese siblings for them.
const LOCALIZED_AGENT_PLATFORMS = new Set([
  "claude",
  "cursor",
  "opencode",
  "codex",
  "kiro",
  "gemini",
  "qoder",
  "codebuddy",
  "droid",
  "pi",
]);

function walkFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else files.push(fullPath);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function discoverCanonicalAgentSources(): CanonicalAgentSource[] {
  const sourcePattern = new RegExp(
    `^([^/]+)/(?:agents|droids)/trellis-(?:check|implement|research)\\.(md|toml|json)$`,
  );

  return walkFiles(root).flatMap((englishPath) => {
    const relativePath = path
      .relative(root, englishPath)
      .split(path.sep)
      .join("/");
    const match = sourcePattern.exec(relativePath);
    if (!match || !LOCALIZED_AGENT_PLATFORMS.has(match[1])) return [];
    const extension = match[2] as CanonicalAgentSource["extension"];
    return [
      {
        platform: match[1],
        extension,
        englishPath,
        chinesePath: englishPath.replace(
          new RegExp(`\\.${extension}$`),
          `.zh.${extension}`,
        ),
        relativePath,
      },
    ];
  });
}

const canonicalAgentSources = discoverCanonicalAgentSources();
const placeholders = (text: string): string[] =>
  [...(text.match(/\{\{[^{}\n]+\}\}/g) ?? [])].sort();
const fences = (text: string): string[] =>
  [...text.matchAll(/^```([^\n]*)$/gm)].map((match) => match[1]);
const technicalTokens = (text: string): string[] =>
  [...(text.match(/`[^`\n]+`/g) ?? [])]
    .filter((token) =>
      /[./_<>{}-]|\.md|\.jsonl|git |python3|trellis-/i.test(token),
    )
    .sort();

function markdownFrontmatterDescription(text: string): string {
  const end = text.indexOf("\n---\n", 4);
  if (!text.startsWith("---\n") || end < 0) return "";
  const frontmatter = text.slice(4, end);
  const block = /^description:\s*\|\s*\n((?:\s+.+\n?)*)/m.exec(
    frontmatter,
  )?.[1];
  if (block !== undefined) return block.trim();
  return /^description:\s*(.+)$/m.exec(frontmatter)?.[1].trim() ?? "";
}

function markdownFrontmatterWithoutDescription(text: string): string[] {
  const end = text.indexOf("\n---\n", 4);
  expect(text.startsWith("---\n")).toBe(true);
  expect(end).toBeGreaterThan(3);
  const lines = text.slice(4, end).split("\n");
  const kept: string[] = [];
  let skippingDescription = false;
  for (const line of lines) {
    if (line.startsWith("description:")) {
      skippingDescription = true;
      continue;
    }
    if (skippingDescription && /^\s/.test(line)) continue;
    skippingDescription = false;
    kept.push(line);
  }
  return kept;
}

function extractAgentPrompt(
  content: string,
  extension: CanonicalAgentSource["extension"],
): string {
  if (extension === "json") {
    const parsed = JSON.parse(content) as { prompt?: unknown };
    return typeof parsed.prompt === "string" ? parsed.prompt : "";
  }
  if (extension === "toml") {
    return (
      /developer_instructions = """\n([\s\S]*?)\n"""/.exec(content)?.[1] ?? ""
    );
  }
  return content;
}

function tomlCommentsOutsideDeveloperInstructions(content: string): string {
  const withoutDeveloperInstructions = content.replace(
    /developer_instructions = """\n[\s\S]*?\n"""/,
    "",
  );
  return [...withoutDeveloperInstructions.matchAll(/^\s*#\s?(.*)$/gm)]
    .map((match) => match[1].trim())
    .filter((comment) => comment !== "")
    .join("\n");
}

describe("localized platform agents", () => {
  it("discovers every canonical English agent source and requires a Chinese sibling", () => {
    expect(canonicalAgentSources.length).toBeGreaterThan(0);
    for (const source of canonicalAgentSources) {
      expect(
        fs.existsSync(source.chinesePath),
        source.relativePath.replace(
          new RegExp(`\\.${source.extension}$`),
          `.zh.${source.extension}`,
        ),
      ).toBe(true);
    }
  });

  for (const source of canonicalAgentSources) {
    it(`${source.relativePath} preserves structure and localizes all human-facing surfaces`, () => {
      const english = fs.readFileSync(source.englishPath, "utf-8");
      const chinese = fs.readFileSync(source.chinesePath, "utf-8");
      const enJson =
        source.extension === "json"
          ? (JSON.parse(english) as Record<string, unknown>)
          : null;
      const zhJson =
        source.extension === "json"
          ? (JSON.parse(chinese) as Record<string, unknown>)
          : null;
      const englishProse = extractAgentPrompt(english, source.extension);
      const chineseProse = extractAgentPrompt(chinese, source.extension);

      expect(chinese, source.relativePath).toMatch(CJK_RE);
      expect(placeholders(chineseProse), source.relativePath).toEqual(
        placeholders(englishProse),
      );
      expect(fences(chineseProse), source.relativePath).toEqual(
        fences(englishProse),
      );
      expect(technicalTokens(chineseProse), source.relativePath).toEqual(
        technicalTokens(englishProse),
      );
      expectCompleteChineseMarkdown(
        englishProse,
        chineseProse,
        source.relativePath,
      );

      if (source.extension === "md") {
        const description = markdownFrontmatterDescription(chinese);
        expect(description, source.relativePath).toMatch(CJK_RE);
        expectLocalizedChineseProse(
          description,
          source.relativePath,
          "frontmatter description",
        );
        expect(markdownFrontmatterWithoutDescription(chinese)).toEqual(
          markdownFrontmatterWithoutDescription(english),
        );
      } else if (source.extension === "json") {
        if (!enJson || !zhJson)
          throw new Error(`Invalid JSON: ${source.relativePath}`);
        expect(zhJson.description, source.relativePath).toMatch(CJK_RE);
        expectLocalizedChineseProse(
          String(zhJson.description ?? ""),
          source.relativePath,
          "JSON description",
        );
        for (const key of ["name", "tools", "allowedTools", "hooks"] as const) {
          expect(zhJson[key], `${source.relativePath}:${key}`).toEqual(
            enJson[key],
          );
        }
        expect(Object.keys(zhJson)).toEqual(Object.keys(enJson));
      } else {
        const description =
          /^description = "([^"]+)"$/m.exec(chinese)?.[1] ?? "";
        expect(description, source.relativePath).toMatch(CJK_RE);
        expectLocalizedChineseProse(
          description,
          source.relativePath,
          "TOML description",
        );
        for (const assignment of ['name = "', 'sandbox_mode = "']) {
          expect(chinese, `${source.relativePath}:${assignment}`).toContain(
            assignment,
          );
        }
        for (const assignment of ["multi_agent = false", "enabled = false"]) {
          expect(chinese.includes(assignment), source.relativePath).toBe(
            english.includes(assignment),
          );
        }
        expect(chinese.match(/developer_instructions = """/g)).toHaveLength(1);
        expect(chinese.match(/^"""$/gm)).toHaveLength(1);
        const comments = tomlCommentsOutsideDeveloperInstructions(chinese);
        expect(comments, `${source.relativePath}: TOML comments`).toBe(
          tomlCommentsOutsideDeveloperInstructions(english),
        );
      }
    });
  }
});

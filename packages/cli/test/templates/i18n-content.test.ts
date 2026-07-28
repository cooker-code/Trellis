import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getBundledSkillTemplates } from "../../src/templates/common/index.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(testDir, "../../src/templates");
const bundledDir = path.join(templatesDir, "common", "bundled-skills");
const specDir = path.join(templatesDir, "markdown", "spec");
function walkFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(fullPath));
    else result.push(fullPath);
  }
  return result.sort((left, right) => left.localeCompare(right));
}

function extractMatches(content: string, pattern: RegExp): string[] {
  return [...content.matchAll(pattern)].map((match) => match[1]).sort();
}

function fenceLanguages(content: string): string[] {
  return [...content.matchAll(/^```([^\n]*)$/gm)].map((match) => match[1]);
}

function tableShape(content: string): number[] {
  return content
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => (line.match(/\|/g) ?? []).length);
}

function inlineCode(content: string): string[] {
  const withoutFences = content.replace(/^```[^\n]*\n[\s\S]*?^```$/gm, "");
  return extractMatches(withoutFences, /`([^`\n]+)`/g);
}

function frontmatterName(content: string): string | undefined {
  return /^---\n[\s\S]*?^name:\s*([^\n]+)$/m.exec(content)?.[1].trim();
}

function expectProtectedMarkdownParity(
  englishPath: string,
  chinesePath: string,
): void {
  const english = fs.readFileSync(englishPath, "utf-8");
  const chinese = fs.readFileSync(chinesePath, "utf-8");

  expect(chinese).toMatch(/[\u3400-\u9fff]/);
  expect(extractMatches(chinese, /\]\(([^)\n]+)\)/g)).toEqual(
    extractMatches(english, /\]\(([^)\n]+)\)/g),
  );
  expect(fenceLanguages(chinese)).toEqual(fenceLanguages(english));
  expect((chinese.match(/```/g) ?? []).length).toBe(
    (english.match(/```/g) ?? []).length,
  );
  expect(tableShape(chinese)).toEqual(tableShape(english));
  const chineseInlineCode = inlineCode(chinese);
  expect(chineseInlineCode.every((code) => !code.includes(".zh."))).toBe(true);
  const englishName = frontmatterName(english);
  if (englishName !== undefined)
    expect(frontmatterName(chinese)).toBe(englishName);
}

describe("bundled-skill locale selection", () => {
  it("lands Chinese content at logical paths without locale cache leakage", () => {
    const readSkill = (locale: "en" | "zh") => {
      const skill = getBundledSkillTemplates(locale).find(
        ({ name }) => name === "trellis-meta",
      );
      expect(skill).toBeDefined();
      if (!skill) throw new Error("trellis-meta bundled skill is missing");
      return skill;
    };
    const englishBefore = readSkill("en");
    const chinese = readSkill("zh");
    const englishAfter = readSkill("en");
    const englishEntry = englishBefore.files.find(
      ({ relativePath }) => relativePath === "SKILL.md",
    );
    const chineseEntry = chinese.files.find(
      ({ relativePath }) => relativePath === "SKILL.md",
    );

    expect(englishAfter).toEqual(englishBefore);
    expect(chinese.files.map(({ relativePath }) => relativePath)).toEqual(
      englishBefore.files.map(({ relativePath }) => relativePath),
    );
    expect(
      chinese.files.every(({ relativePath }) => !relativePath.includes(".zh.")),
    ).toBe(true);
    expect(englishEntry?.content).toBe(
      fs.readFileSync(
        path.join(bundledDir, "trellis-meta", "SKILL.md"),
        "utf-8",
      ),
    );
    expect(chineseEntry?.content).toBe(
      fs.readFileSync(
        path.join(bundledDir, "trellis-meta", "SKILL.zh.md"),
        "utf-8",
      ),
    );
  });
});

describe("Chinese template source coverage", () => {
  it("validates every reviewed bundled-skill Chinese source recursively", () => {
    const localizedBundles = new Set([
      "trellis-meta",
      "trellis-spec-bootstrap",
    ]);
    const englishFiles = walkFiles(bundledDir).filter(
      (file) =>
        file.endsWith(".md") &&
        !file.endsWith(".zh.md") &&
        localizedBundles.has(
          path.relative(bundledDir, file).split(path.sep)[0],
        ) &&
        fs.existsSync(file.replace(/\.md$/, ".zh.md")),
    );

    expect(englishFiles.length).toBeGreaterThan(0);
    for (const englishPath of englishFiles) {
      const chinesePath = englishPath.replace(/\.md$/, ".zh.md");
      expectProtectedMarkdownParity(englishPath, chinesePath);
    }
  });

  it("pairs every canonical compound-suffix spec source, including dormant files", () => {
    const englishFiles = walkFiles(specDir).filter(
      (file) => file.endsWith(".md.txt") && !file.endsWith(".zh.md.txt"),
    );

    expect(englishFiles.length).toBeGreaterThan(0);
    for (const englishPath of englishFiles) {
      const chinesePath = englishPath.replace(/\.md\.txt$/, ".zh.md.txt");
      expect(
        fs.existsSync(chinesePath),
        `missing spec translation for ${path.relative(specDir, englishPath)}`,
      ).toBe(true);
      expectProtectedMarkdownParity(englishPath, chinesePath);
    }
  });
});

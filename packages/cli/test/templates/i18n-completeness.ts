import { expect } from "vitest";

export const CJK_RE = /[\u3400-\u9fff]/;

interface FencedBlock {
  language: string;
  body: string;
  reportLike: boolean;
}

interface MarkdownSegments {
  prose: string[];
  fences: FencedBlock[];
}

interface MarkdownShape {
  headingLevels: number[];
  tableCellCounts: number[];
  listKinds: string[];
}

// Narrow by design. This allowlist contains only agreed product/platform
// names, Trellis domain/protocol terms, tool names, and data/code formats that
// intentionally stay English in Chinese prose. Ordinary process/report words
// (for example review, caller, deliverable, scope, checklist, and best
// practices) are intentionally absent so a Chinese sentence with an English
// tail fails instead of passing merely because the line contains one CJK rune.
const TECHNICAL_PHRASES = [
  "Active task",
  "Claude Code",
  "Factory Droid",
  "Pi Agent",
  "Code-Spec",
  "code-spec",
  "Trellis",
  "GitNexus",
  "ABCoder",
  "GitHub",
  "GitLab",
  "OpenAI",
  "git diff",
  "file:line",
  "session-start",
  "type check",
  "type-check",
  "class-2",
  "workflow-state",
  "workspace-write",
  "generic/default/generalPurpose",
  "YYYY-MM-DD",
  "Codex",
  "Cursor",
  "OpenCode",
  "Gemini CLI",
  "Gemini",
  "Kiro",
  "Qoder",
  "CodeBuddy",
  "Copilot",
  "Droid",
  "Antigravity",
  "Windsurf",
  "Windows",
  "macOS",
  "Linux",
] as const;

const TECHNICAL_WORDS = new Set([
  "Agent",
  "AI",
  "API",
  "Bash",
  "CLI",
  "branch",
  "commit",
  "completed",
  "DB",
  "diff",
  "DONE",
  "E2E",
  "Edit",
  "ESLint",
  "Git",
  "Glob",
  "Grep",
  "git",
  "Hook",
  "HTML",
  "HTTP",
  "HTTPS",
  "JavaScript",
  "JSON",
  "JSONL",
  "Lint",
  "Markdown",
  "MCP",
  "merge",
  "lint",
  "Node",
  "Phase",
  "PR",
  "PRD",
  "push",
  "Python",
  "React",
  "Read",
  "README",
  "Session",
  "SessionStart",
  "SHA",
  "Skill",
  "Spec",
  "Specs",
  "SQL",
  "Step",
  "Sub-agent",
  "Task",
  "TODO",
  "TOML",
  "TypeCheck",
  "TypeScript",
  "URL",
  "UTF",
  "Vitest",
  "Vue",
  "Write",
  "workflow",
  "fork",
  "agent",
  "agents",
  "hook",
  "phase",
  "session",
  "skill",
  "spec",
  "specs",
  "step",
  "sub-agent",
  "task",
  "tasks",
  "title",
  "trellis",
  "typecheck",
  "slug",
  "YAML",
]);

function withoutFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---\n", 4);
  return end < 0 ? content : content.slice(end + 5);
}

function splitMarkdownSegments(content: string): MarkdownSegments {
  const markdown = withoutFrontmatter(content);
  const prose: string[] = [];
  const fences: FencedBlock[] = [];
  const pattern = /^[ \t]*```([^\n]*)\n([\s\S]*?)^[ \t]*```[ \t]*$/gm;
  let cursor = 0;

  for (const match of markdown.matchAll(pattern)) {
    const index = match.index ?? 0;
    prose.push(markdown.slice(cursor, index));
    const language = match[1].trim().toLowerCase();
    const body = match[2];
    fences.push({
      language,
      body,
      reportLike:
        language === "markdown" ||
        language === "md" ||
        (language === "" &&
          /^(?:#{1,6}\s+|\s*[-*+]\s+(?:\[[ xX]\]\s+|\*\*[^*]+\*\*|[^:：]+[:：])|\s*\|.+\|\s*$)/m.test(
            body,
          )),
    });
    cursor = index + match[0].length;
  }

  prose.push(markdown.slice(cursor));
  return { prose, fences };
}

function stripTechnicalText(text: string): string {
  let result = text;
  for (const phrase of TECHNICAL_PHRASES) {
    result = result.replaceAll(phrase, " ");
  }

  result = result
    .replace(/`[^`\n]+`/g, " ")
    .replace(/\{\{[^}\n]+\}\}/g, " ")
    .replace(/\{[A-Z][A-Z0-9_]*\}/g, " ")
    .replace(/<[^>\n]+>/g, " ")
    .replace(/\[([^\]\n]*)\]\([^\n)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(
      /(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.*<>-]+\.[A-Za-z0-9_.-]+/g,
      " ",
    )
    .replace(/\.?[A-Za-z0-9_.-]+\/(?=[\s),），。、]|$)/g, " ")
    .replace(/\b[a-z]+(?:[A-Z][A-Za-z0-9]*)+\b/g, " ")
    .replace(/--[a-z0-9-]+/gi, " ")
    .replace(/\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_.*-]+)+\b/g, " ")
    .replace(/\b(?:trellis-[a-z0-9-]+|mcp__[A-Za-z0-9_*_-]+)\b/gi, " ");

  return result.replace(/[A-Za-z][A-Za-z-]*/g, (word) =>
    TECHNICAL_WORDS.has(word) ? " " : word,
  );
}

function untranslatedAsciiWords(text: string): string[] {
  return [...stripTechnicalText(text).matchAll(/[A-Za-z][A-Za-z-]+/g)].map(
    ([word]) => word,
  );
}

export function expectLocalizedChineseProse(
  text: string,
  relativePath: string,
  context: string,
): void {
  const untranslatedWords = untranslatedAsciiWords(text);
  expect(
    untranslatedWords,
    `${relativePath}: untranslated ${context} ASCII prose: ${untranslatedWords.join(
      ", ",
    )}`,
  ).toEqual([]);
}

function expectLocalizedUnit(
  text: string,
  relativePath: string,
  context: string,
): void {
  expectLocalizedChineseProse(text, relativePath, context);
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function listKind(line: string): string | undefined {
  const match = /^\s*(?:([-*+])|(\d+)\.)\s+(.*)$/.exec(line);
  if (!match) return undefined;
  if (/^\[[ xX]\]\s+/.test(match[3])) return "checklist";
  return match[1] ? "unordered" : "ordered";
}

function markdownShape(texts: string[]): MarkdownShape {
  const headingLevels: number[] = [];
  const tableCellCounts: number[] = [];
  const listKinds: string[] = [];

  for (const text of texts) {
    for (const line of text.split("\n")) {
      const heading = /^(#{1,6})\s+/.exec(line);
      if (heading) headingLevels.push(heading[1].length);
      if (/^\s*\|.*\|\s*$/.test(line)) {
        tableCellCounts.push(tableCells(line).length);
      }
      const kind = listKind(line);
      if (kind) listKinds.push(kind);
    }
  }

  return { headingLevels, tableCellCounts, listKinds };
}

function expectLocalizedMarkdownText(
  text: string,
  relativePath: string,
  surface: string,
): void {
  for (const [index, line] of text.split("\n").entries()) {
    const lineContext = `${surface} line ${index + 1}`;
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      expectLocalizedUnit(heading[1], relativePath, `${lineContext} heading`);
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      for (const cell of tableCells(line)) {
        if (/^:?-{3,}:?$/.test(cell)) continue;
        expectLocalizedUnit(cell, relativePath, `${lineContext} table cell`);
      }
      continue;
    }

    const list = /^\s*(?:[-*+]|\d+\.)\s+(.+)$/.exec(line);
    if (list) {
      const item = list[1].replace(/^\[[ xX]\]\s+/, "");
      expectLocalizedUnit(item, relativePath, `${lineContext} list item`);
      for (const label of item.matchAll(/\*\*([^*\n]+)\*\*/g)) {
        expectLocalizedUnit(
          label[1],
          relativePath,
          `${lineContext} emphasized list label`,
        );
      }
      const plainLabel = /^([^`*]+?)\s*[:：]/.exec(
        stripTechnicalText(item),
      );
      if (plainLabel) {
        expectLocalizedUnit(
          plainLabel[1],
          relativePath,
          `${lineContext} list label`,
        );
      }
      continue;
    }

    for (const label of line.matchAll(/\*\*([^*\n]+)\*\*/g)) {
      expectLocalizedUnit(
        label[1],
        relativePath,
        `${lineContext} emphasized label`,
      );
    }

    const prose = line
      .replace(/^\s*>\s?/, "")
      .replace(/^\s*#+\s*/, "")
      .trim();
    if (
      prose === "" ||
      prose.replaceAll("\\", "").startsWith("```") ||
      /^---+$/.test(prose) ||
      /^<!--.*-->$/.test(prose) ||
      /^\[[A-Za-z0-9_, -]+\]$/.test(prose) ||
      /^\[\/[A-Za-z0-9_, -]+\]$/.test(prose)
    ) {
      continue;
    }
    expectLocalizedUnit(prose, relativePath, `${lineContext} prose`);
  }
}

function expectLocalizedFencedExample(
  fence: FencedBlock,
  relativePath: string,
  index: number,
): void {
  if (fence.reportLike) {
    expectLocalizedMarkdownText(
      fence.body,
      relativePath,
      `fenced report ${index + 1}`,
    );
    return;
  }

  for (const [lineIndex, line] of fence.body.split("\n").entries()) {
    const comment = /(?:^|\s)#\s+(.+)$/.exec(line)?.[1];
    if (comment) {
      expectLocalizedUnit(
        comment,
        relativePath,
        `fenced example ${index + 1} line ${lineIndex + 1} comment`,
      );
    }
    for (const value of line.matchAll(
      /--(?:title|summary|description|message)\s+"([^"]+)"/g,
    )) {
      expectLocalizedUnit(
        value[1],
        relativePath,
        `fenced example ${index + 1} line ${lineIndex + 1} value`,
      );
    }
  }
}

export function expectCompleteChineseMarkdown(
  english: string,
  chinese: string,
  relativePath: string,
): void {
  expect(chinese, `${relativePath}: Chinese prose`).toMatch(CJK_RE);

  const englishSegments = splitMarkdownSegments(english);
  const chineseSegments = splitMarkdownSegments(chinese);
  expect(
    chineseSegments.fences.map(({ language }) => language),
    `${relativePath}: fenced language sequence`,
  ).toEqual(englishSegments.fences.map(({ language }) => language));

  const englishShape = markdownShape([
    ...englishSegments.prose,
    ...englishSegments.fences
      .filter(({ reportLike }) => reportLike)
      .map(({ body }) => body),
  ]);
  const chineseShape = markdownShape([
    ...chineseSegments.prose,
    ...chineseSegments.fences
      .filter(({ reportLike }) => reportLike)
      .map(({ body }) => body),
  ]);
  expect(chineseShape, `${relativePath}: Markdown structure`).toEqual(
    englishShape,
  );

  for (const [index, prose] of chineseSegments.prose.entries()) {
    expectLocalizedMarkdownText(prose, relativePath, `section ${index + 1}`);
  }
  for (const [index, fence] of chineseSegments.fences.entries()) {
    expectLocalizedFencedExample(fence, relativePath, index);
  }
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getBundledSkillTemplates,
  getCommandTemplates,
  getCommonDescriptions,
  getPullBasedPreludeTemplate,
  getSkillTemplates,
} from "../../src/templates/common/index.js";
import {
  buildPullBasedPrelude,
  resolveAllAsSkills,
  resolvePlaceholders,
  wrapWithSkillFrontmatter,
} from "../../src/configurators/shared.js";
import { AI_TOOLS } from "../../src/types/ai-tools.js";
import {
  CJK_RE,
  expectCompleteChineseMarkdown,
  expectLocalizedChineseProse,
} from "./i18n-completeness.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/templates/common",
);
const placeholders = (text: string): string[] =>
  [...(text.match(/\{\{[^{}\n]+\}\}/g) ?? [])].sort();

describe("translation completeness scanner", () => {
  it.each([3, 4, 5, 6])(
    "rejects an untranslated level-%i heading inside otherwise Chinese content",
    (level) => {
      const heading = `${"#".repeat(level)} Human Facing Label`;
      const content = `# 已翻译\n\n${heading}\n\n已翻译正文。\n`;
      expect(() =>
        expectCompleteChineseMarkdown(content, content, `fixture-h${level}.md`),
      ).toThrow(/untranslated .*heading/);
    },
  );

  it.each([
    ["table cell", "| Human Label | 已翻译 |\n|---|---|"],
    ["list label", "- **Human Label**：已翻译"],
    [
      "fenced report label",
      "```markdown\n# 已翻译报告\n\n- Query: 已翻译\n```",
    ],
    ["middle prose", "Untranslated middle paragraph.\n\n已翻译结尾。"],
    ["mixed prose tail", "已翻译正文 with an untranslated tail."],
    ["mixed list tail", "- 遵循 best practices"],
    ["mixed label tail", "- **输出**：file list 和 pattern notes"],
    ["slash-separated prose", "检查 request/response contract。"],
  ])("rejects an untranslated %s anywhere in a section", (_name, fragment) => {
    const content = `# 已翻译\n\n${fragment}\n`;
    expect(() =>
      expectCompleteChineseMarkdown(content, content, "fixture.md"),
    ).toThrow(/untranslated/);
  });

  it.each([
    "Trellis workflow 使用 Task、Spec、Skill、Agent、Hook、Session、SessionStart、Sub-agent、JSONL、PRD、Phase 和 Step。",
    "Claude Code、Cursor、OpenCode、Codex、Gemini CLI、Kiro、Qoder、CodeBuddy、Copilot、Factory Droid 均保留平台名。",
    "读取 `implement.jsonl`、`.trellis/spec/`、`task.py current --source`、`TRELLIS_LANGUAGE`、`task.json.status` 和 {{PYTHON_CMD}}。",
    "保留协议标签 Active task: <path>。",
  ])("allows documented technical/protocol prose: %s", (prose) => {
    const content = `# 已翻译\n\n${prose}\n`;
    expect(() =>
      expectCompleteChineseMarkdown(content, content, "fixture-allowed.md"),
    ).not.toThrow();
  });
});

describe("common localized templates", () => {
  for (const dir of ["commands", "skills"] as const) {
    it(`pairs every canonical ${dir} source with a valid Chinese sibling`, () => {
      const sourceDir = path.join(root, dir);
      const englishFiles = fs
        .readdirSync(sourceDir)
        .filter((file) => file.endsWith(".md") && !file.endsWith(".zh.md"))
        .sort();

      for (const englishFile of englishFiles) {
        const chineseFile = englishFile.replace(/\.md$/, ".zh.md");
        const english = fs.readFileSync(path.join(sourceDir, englishFile), "utf-8");
        const chinesePath = path.join(sourceDir, chineseFile);
        expect(fs.existsSync(chinesePath), chineseFile).toBe(true);
        const chinese = fs.readFileSync(chinesePath, "utf-8");
        expect(CJK_RE.test(chinese), chineseFile).toBe(true);
        expect(placeholders(chinese), chineseFile).toEqual(placeholders(english));
        expectCompleteChineseMarkdown(
          english,
          chinese,
          `${dir}/${chineseFile}`,
        );
      }
    });
  }

  it("keeps logical names stable across en -> zh -> en cache access", () => {
    const read = (locale: "en" | "zh") => [
      ...getCommandTemplates(locale),
      ...getSkillTemplates(locale),
    ];
    const englishBefore = read("en");
    const chinese = read("zh");
    const englishAfter = read("en");

    expect(englishAfter).toEqual(englishBefore);
    expect(chinese.map(({ name }) => name)).toEqual(
      englishBefore.map(({ name }) => name),
    );
    expect(chinese.every(({ name }) => !name.includes(".zh"))).toBe(true);
    expect(chinese.some(({ content }) => /[\u3400-\u9fff]/.test(content))).toBe(true);
  });

  it("localizes generated metadata and pull-based prose", () => {
    const english = getCommonDescriptions("en");
    const chinese = getCommonDescriptions("zh");
    expect(Object.keys(chinese).sort()).toEqual(Object.keys(english).sort());
    expect(/[\u3400-\u9fff]/.test(chinese.commands.start)).toBe(true);
    expect(/[\u3400-\u9fff]/.test(chinese.skills.check)).toBe(true);
    for (const [group, descriptions] of Object.entries(chinese)) {
      for (const [name, description] of Object.entries(descriptions)) {
        expectLocalizedChineseProse(
          description,
          "common/descriptions.zh.json",
          `${group}.${name}`,
        );
      }
    }

    const zhPrelude = buildPullBasedPrelude("implement", "zh");
    expect(zhPrelude).toContain("Active task: <path>");
    expect(zhPrelude).toContain("implement.jsonl");
    expect(/[\u3400-\u9fff]/.test(zhPrelude)).toBe(true);
    expectCompleteChineseMarkdown(
      getPullBasedPreludeTemplate("en"),
      getPullBasedPreludeTemplate("zh"),
      "common/agent-preludes/pull-based.zh.md",
    );
    expect(placeholders(getPullBasedPreludeTemplate("zh"))).toEqual(
      placeholders(getPullBasedPreludeTemplate("en")),
    );
  });

  it("preserves legacy English skill bytes while localizing Chinese frontmatter", () => {
    const ctx = AI_TOOLS.kilo.templateContext;
    for (const template of resolveAllAsSkills(ctx, "en")) {
      const source = [...getCommandTemplates("en"), ...getSkillTemplates("en")]
        .find(({ name }) => `trellis-${name}` === template.name);
      expect(source, template.name).toBeDefined();
      if (!source) throw new Error(`Missing common template: ${template.name}`);
      const resolved = resolvePlaceholders(source.content, ctx);
      expect(template.content).toBe(
        wrapWithSkillFrontmatter(template.name, resolved),
      );
    }

    for (const template of resolveAllAsSkills(ctx, "zh")) {
      expect(template.content).toContain(`name: ${template.name}`);
      expect(/[\u3400-\u9fff]/.test(template.content)).toBe(true);
    }
  });

  it("provides locale-aware recursive bundled-skill paths for PR3", () => {
    const shape = (locale: "en" | "zh") =>
      getBundledSkillTemplates(locale).map((skill) => ({
        name: skill.name,
        files: skill.files.map(({ relativePath }) => relativePath),
      }));
    expect(shape("zh")).toEqual(shape("en"));
    expect(
      shape("zh").every(({ files }) =>
        files.every((file) => !file.includes(".zh.")),
      ),
    ).toBe(true);
  });
});

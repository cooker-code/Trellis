import {
  execFileSync,
  spawnSync,
  type SpawnSyncReturns,
} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  checkChineseWorkflowCompleteness,
  compareLocalizedTemplateStructure,
  comparePythonStringBundles,
  compareWorkflowStructure,
  englishCounterpart,
  extractWorkflowStructure,
  isLocalizedTemplateFile,
} from "../../scripts/check-i18n-drift.js";

interface Diagnostic {
  category: string;
  message: string;
}

const testDir = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(testDir, "../../src/templates/trellis");
const englishWorkflow = fs.readFileSync(
  path.join(templateDir, "workflow.md"),
  "utf-8",
);
const chineseWorkflow = fs.readFileSync(
  path.join(templateDir, "workflow.zh.md"),
  "utf-8",
);

function categories(diagnostics: Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.category);
}

function writeFixtureFile(
  fixtureRoot: string,
  relativePath: string,
  content: string,
): void {
  const destination = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content, "utf-8");
}

function createCheckerFixture(): string {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "trellis-i18n-checker-"),
  );
  writeFixtureFile(fixtureRoot, "package.json", '{"type":"module"}\n');
  const checkerSource = path.resolve(
    testDir,
    "../../scripts/check-i18n-drift.js",
  );
  const checkerDestination = path.join(
    fixtureRoot,
    "scripts",
    "check-i18n-drift.js",
  );
  fs.mkdirSync(path.dirname(checkerDestination), { recursive: true });
  fs.copyFileSync(checkerSource, checkerDestination);
  writeFixtureFile(
    fixtureRoot,
    "src/templates/trellis/scripts/common/i18n_strings/en.py",
    "STRINGS = {}\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "src/templates/trellis/scripts/common/i18n_strings/zh.py",
    "STRINGS = {}\n",
  );
  return fixtureRoot;
}

function runChecker(
  fixtureRoot: string,
  args: string[] = [],
): SpawnSyncReturns<string> {
  const checkerPath = fs.realpathSync(
    path.join(fixtureRoot, "scripts", "check-i18n-drift.js"),
  );
  return spawnSync(process.execPath, [checkerPath, ...args], {
    cwd: fixtureRoot,
    encoding: "utf-8",
  });
}

function runGit(fixtureRoot: string, args: string[]): void {
  execFileSync("git", args, {
    cwd: fixtureRoot,
    encoding: "utf-8",
    stdio: "ignore",
  });
}

function commitFixture(
  fixtureRoot: string,
  message: string,
  timestamp: string,
): void {
  execFileSync("git", ["add", "."], {
    cwd: fixtureRoot,
    stdio: "ignore",
  });
  execFileSync("git", ["commit", "-q", "-m", message], {
    cwd: fixtureRoot,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: timestamp,
      GIT_COMMITTER_DATE: timestamp,
    },
    stdio: "ignore",
  });
}

describe("localized source discovery", () => {
  it("recognizes compound spec sidecars and restores their English path", () => {
    expect(isLocalizedTemplateFile("guide.zh.md.txt")).toBe(true);
    expect(englishCounterpart("spec/guides/guide.zh.md.txt")).toBe(
      "spec/guides/guide.md.txt",
    );
    expect(isLocalizedTemplateFile("guide.md.txt")).toBe(false);
  });
});

describe("drift-checker CLI behavior", () => {
  it("warns for a missing English counterpart by default and fails only with --strict", () => {
    const fixtureRoot = createCheckerFixture();
    try {
      writeFixtureFile(
        fixtureRoot,
        "src/templates/misc/orphan.zh.md",
        "# 中文孤立翻译\n",
      );

      const warningOnly = runChecker(fixtureRoot);
      const strict = runChecker(fixtureRoot, ["--strict"]);

      expect(warningOnly.status).toBe(0);
      expect(warningOnly.stderr).toContain("MISSING English source");
      expect(warningOnly.stderr).toContain("orphan.zh.md");
      expect(warningOnly.stdout).toContain("1 missing");
      expect(strict.status).toBe(1);
      expect(strict.stderr).toContain("MISSING English source");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("uses Git commit timestamps for stale warnings without changing warning-only semantics", () => {
    const fixtureRoot = createCheckerFixture();
    try {
      writeFixtureFile(
        fixtureRoot,
        "src/templates/misc/demo.md",
        "# English v1\n",
      );
      writeFixtureFile(
        fixtureRoot,
        "src/templates/misc/demo.zh.md",
        "# 中文 v1\n",
      );
      runGit(fixtureRoot, ["init", "-q"]);
      runGit(fixtureRoot, ["config", "user.name", "Trellis Test"]);
      runGit(fixtureRoot, ["config", "user.email", "trellis@example.test"]);
      commitFixture(
        fixtureRoot,
        "initial translation pair",
        "2000-01-01T00:00:00Z",
      );
      writeFixtureFile(
        fixtureRoot,
        "src/templates/misc/demo.md",
        "# English v2\n",
      );
      commitFixture(
        fixtureRoot,
        "newer English source",
        "2001-01-01T00:00:00Z",
      );

      const warningOnly = runChecker(fixtureRoot);
      const strict = runChecker(fixtureRoot, ["--strict"]);

      expect(warningOnly.status).toBe(0);
      expect(warningOnly.stderr).toContain("DRIFT detected");
      expect(warningOnly.stderr).toContain("demo.md");
      expect(warningOnly.stderr).toContain("demo.zh.md");
      expect(warningOnly.stdout).toContain("1 drift");
      expect(strict.status).toBe(1);
      expect(strict.stderr).toContain("DRIFT detected");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});

describe("Python i18n dictionary parity", () => {
  it("reports missing, orphan, and placeholder-mismatched keys", () => {
    expect(
      comparePythonStringBundles(
        {
          shared: "Hello {name}",
          missing: "English only",
        },
        {
          shared: "你好 {user}",
          orphan: "仅中文",
        },
      ),
    ).toEqual([
      { category: "missing localized key", message: "missing" },
      {
        category: "Python placeholder mismatch",
        message: 'shared: expected ["name"], got ["user"]',
      },
      { category: "orphan localized key", message: "orphan" },
    ]);
  });
});

describe("common and agent i18n structural parity", () => {
  const templatesRoot = path.resolve(testDir, "../../src/templates");

  it("accepts real Markdown, JSON, and TOML translation pairs", () => {
    for (const [english, chinese] of [
      ["common/commands/continue.md", "common/commands/continue.zh.md"],
      ["kiro/agents/trellis-check.json", "kiro/agents/trellis-check.zh.json"],
      ["codex/agents/trellis-check.toml", "codex/agents/trellis-check.zh.toml"],
    ]) {
      expect(
        compareLocalizedTemplateStructure(
          fs.readFileSync(path.join(templatesRoot, english), "utf-8"),
          fs.readFileSync(path.join(templatesRoot, chinese), "utf-8"),
          chinese,
        ),
        chinese,
      ).toEqual([]);
    }
  });

  it("reports placeholder, frontmatter, and format schema drift", () => {
    const englishMarkdown =
      "---\nname: demo\ntools: Read\n---\n# Demo\n`file.md` {{VALUE}}\n";
    const localizedMarkdown =
      "---\nname: demo\ntools: Write\n---\n# 示例\n`file.md` {{OTHER}}\n";
    expect(
      categories(
        compareLocalizedTemplateStructure(
          englishMarkdown,
          localizedMarkdown,
          "demo.zh.md",
        ),
      ),
    ).toEqual(
      expect.arrayContaining([
        "Markdown frontmatter schema",
        "Handlebars placeholders",
      ]),
    );

    expect(
      categories(
        compareLocalizedTemplateStructure(
          '{"commands":{"start":"Start"}}',
          '{"commands":{"other":"开始"}}',
          "descriptions.zh.json",
        ),
      ),
    ).toContain("JSON key schema");
  });
});

describe("workflow i18n structural parity", () => {
  it("extracts balanced machine structure from the canonical workflow", () => {
    const structure = extractWorkflowStructure(englishWorkflow);

    expect(structure.workflowStateMarkers).toEqual(
      expect.arrayContaining([
        "[workflow-state:no_task]",
        "[/workflow-state:no_task]",
        "[workflow-state:in_progress]",
        "[/workflow-state:in_progress]",
      ]),
    );
    expect(structure.stepHeadings[0]).toBe("1.0 `[required · once]`");
    expect(structure.stepHeadings).toContain("3.5");
    expect(structure.fencesBalanced).toBe(true);
  });

  it("keeps the real English and Chinese workflow structures equivalent", () => {
    expect(compareWorkflowStructure(englishWorkflow, chineseWorkflow)).toEqual(
      [],
    );
    expect(
      checkChineseWorkflowCompleteness(chineseWorkflow, englishWorkflow),
    ).toEqual([]);
  });

  it("reports a workflow-state marker mismatch", () => {
    const mutated = englishWorkflow.replace(
      "[/workflow-state:planning]",
      "[/workflow-state:broken]",
    );

    expect(
      categories(compareWorkflowStructure(englishWorkflow, mutated)),
    ).toContain("workflow-state markers");
  });

  it("reports a platform marker mismatch", () => {
    const mutated = englishWorkflow.replace(
      "[codex-inline, Kilo, Antigravity, Devin]",
      "[codex-inline, Kilo, Devin]",
    );

    expect(
      categories(compareWorkflowStructure(englishWorkflow, mutated)),
    ).toContain("platform markers");
  });

  it("reports a Step id or qualifier mismatch", () => {
    const mutated = englishWorkflow.replace(
      "#### 2.2 Quality check `[required · repeatable]`",
      "#### 2.9 Quality check `[optional · repeatable]`",
    );

    expect(
      categories(compareWorkflowStructure(englishWorkflow, mutated)),
    ).toContain("Step headings/qualifiers");
  });

  it("reports a placeholder mismatch", () => {
    const mutated = englishWorkflow.replace("<your-name>", "developer-name");

    expect(
      categories(compareWorkflowStructure(englishWorkflow, mutated)),
    ).toContain("placeholders/XML tags");
  });

  it("reports a code-fence mismatch", () => {
    const mutated = englishWorkflow.replace("```bash", "```shell");

    expect(
      categories(compareWorkflowStructure(englishWorkflow, mutated)),
    ).toContain("code fences");
  });

  it("reports a fenced command mismatch", () => {
    const mutated = englishWorkflow.replace(
      "python3 ./.trellis/scripts/init_developer.py <your-name>",
      "python ./.trellis/scripts/init_developer.py <your-name>",
    );

    expect(
      categories(compareWorkflowStructure(englishWorkflow, mutated)),
    ).toContain("fenced technical lines");
  });

  it("reports an inline technical token mismatch", () => {
    const mutated = englishWorkflow.replace("`prd.md`", "`requirements.md`");

    expect(
      categories(compareWorkflowStructure(englishWorkflow, mutated)),
    ).toContain("inline code");
  });

  it.each([
    ["task.py start", "task.py 启动"],
    ["status='planning'", "status='规划中'"],
    ["cmd_archive", "archive_command"],
    ["UserPromptSubmit", "PromptSubmit"],
  ])("reports mutation of bare runtime token %s", (identifier, replacement) => {
    const mutated = chineseWorkflow.replace(identifier, replacement);

    expect(
      categories(compareWorkflowStructure(englishWorkflow, mutated)),
    ).toContain("protected lexical tokens");
  });

  it.each([
    [
      'python3 ./.trellis/scripts/add_session.py --title "标题" --commit "hash" --summary "摘要"',
      'python3 ./.trellis/scripts/add_session.py --title "Title" --commit "hash" --summary "Summary"',
    ],
    ['"你的脚本或命令"', '"your-script-or-command-here"'],
  ])("rejects untranslated human example values", (translated, english) => {
    const mutated = chineseWorkflow.replace(translated, english);

    expect(checkChineseWorkflowCompleteness(mutated, englishWorkflow)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "translation completeness",
          message: expect.stringContaining("untranslated English prose"),
        }),
      ]),
    );
  });

  it("rejects an English-only body tail after earlier Chinese prose", () => {
    const chineseTailStart = chineseWorkflow.indexOf("### 完整契约");
    const englishTailStart = englishWorkflow.indexOf("### Full contract");
    expect(chineseTailStart).toBeGreaterThanOrEqual(0);
    expect(englishTailStart).toBeGreaterThanOrEqual(0);
    const mutated =
      chineseWorkflow.slice(0, chineseTailStart) +
      englishWorkflow.slice(englishTailStart);

    expect(checkChineseWorkflowCompleteness(mutated, englishWorkflow)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "translation completeness",
          message: expect.stringContaining("untranslated English prose"),
        }),
      ]),
    );
  });
});

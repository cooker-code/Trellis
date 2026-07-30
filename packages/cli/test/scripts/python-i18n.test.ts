import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getAllScripts } from "../../src/templates/trellis/index.js";

const pythonCommand = process.platform === "win32" ? "python" : "python3";
const sessionEnvKeys = [
  "TRELLIS_CONTEXT_ID",
  "PI_SESSION_ID",
  "CODEX_SESSION_ID",
  "CODEX_THREAD_ID",
  "CLAUDE_SESSION_ID",
  "OPENCODE_RUN_ID",
  "CURSOR_SESSION_ID",
];

function cleanEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env, ...overrides };
  for (const key of sessionEnvKeys) {
    if (!(key in overrides)) Reflect.deleteProperty(env, key);
  }
  return env;
}

describe("distributed Python i18n", () => {
  let tmpDir: string;
  let scriptsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-python-i18n-"));
    scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [relativePath, content] of getAllScripts()) {
      const destination = path.join(scriptsDir, relativePath);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, content, "utf-8");
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runScript(
    relativePath: string,
    args: string[],
    env: NodeJS.ProcessEnv = {},
  ): SpawnSyncReturns<string> {
    return spawnSync(
      pythonCommand,
      [path.join(scriptsDir, relativePath), ...args],
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: cleanEnv(env),
      },
    );
  }

  function writeProjectFile(relativePath: string, content: string): void {
    const destination = path.join(tmpDir, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content, "utf-8");
  }

  function installHookProbe(): void {
    writeProjectFile(
      ".trellis/hook-probe.py",
      [
        "from __future__ import annotations",
        "import os",
        "import sys",
        "from pathlib import Path",
        "event = sys.argv[1]",
        "task_json_path = os.environ.get('TASK_JSON_PATH', '')",
        "with Path('.trellis/hook-events.txt').open('a', encoding='utf-8') as handle:",
        "    handle.write(f'{event}|{task_json_path}\\n')",
        "print(f'HOOK STDOUT {event}')",
        "print(f'HOOK STDERR {event}', file=sys.stderr)",
        "if event == 'fail':",
        "    raise SystemExit(7)",
        "",
      ].join("\n"),
    );
  }

  function writeHookConfig(hooks: Record<string, string[]>): void {
    const lines = ["language: zh", "session_auto_commit: false", "hooks:"];
    for (const [event, commands] of Object.entries(hooks)) {
      lines.push(`  ${event}:`);
      for (const command of commands) lines.push(`    - ${command}`);
    }
    writeProjectFile(".trellis/config.yaml", `${lines.join("\n")}\n`);
  }

  function hookCommand(event: string): string {
    return `${pythonCommand} .trellis/hook-probe.py ${event}`;
  }

  function readHookEvents(): { event: string; taskJsonPath: string }[] {
    return fs
      .readFileSync(path.join(tmpDir, ".trellis", "hook-events.txt"), "utf-8")
      .trim()
      .split("\n")
      .map((line) => {
        const separator = line.indexOf("|");
        return {
          event: line.slice(0, separator),
          taskJsonPath: line.slice(separator + 1),
        };
      });
  }

  it("uses English by default and TRELLIS_LANGUAGE for entry-point help", () => {
    const englishTask = runScript("task.py", ["--help"]);
    const chineseTask = runScript("task.py", ["--help"], {
      TRELLIS_LANGUAGE: "zh",
    });
    const chineseSession = runScript("add_session.py", ["--help"], {
      TRELLIS_LANGUAGE: "zh",
    });

    expect(englishTask.status).toBe(0);
    expect(englishTask.stdout).toContain("Task Management Script");
    expect(chineseTask.status).toBe(0);
    expect(chineseTask.stdout).toContain("Task 管理脚本");
    expect(chineseSession.status).toBe(0);
    expect(chineseSession.stdout).toContain("向 journal 文件添加新 session");
  });

  it("uses config language when env is absent and lets env override config", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "config.yaml"),
      "language: zh  # project default\n",
      "utf-8",
    );

    const fromConfig = runScript("get_context.py", ["--mode", "packages"]);
    const fromEnv = runScript("get_context.py", ["--mode", "packages"], {
      TRELLIS_LANGUAGE: "en",
    });

    expect(fromConfig.status).toBe(0);
    expect(fromConfig.stdout).toContain("Single-repo 项目");
    expect(fromEnv.status).toBe(0);
    expect(fromEnv.stdout).toContain("Single-repo project");
  });

  it.each([
    { language: "en", message: "workflow.md not found: " },
    { language: "zh", message: "找不到 workflow.md：" },
  ])(
    "localizes the missing workflow FileNotFoundError in $language",
    ({ language, message }) => {
      const result = runScript("get_context.py", ["--mode", "phase"], {
        TRELLIS_LANGUAGE: language,
      });
      const workflowPath = path.join(
        fs.realpathSync(tmpDir),
        ".trellis",
        "workflow.md",
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("FileNotFoundError:");
      expect(result.stderr).toContain(`${message}${workflowPath}`);
    },
  );

  it("localizes developer initialization", () => {
    const usage = runScript("init_developer.py", [], {
      TRELLIS_LANGUAGE: "zh",
    });
    expect(usage.status).toBe(1);
    expect(usage.stdout).toContain("用法");

    const initialized = runScript("init_developer.py", ["alice"], {
      TRELLIS_LANGUAGE: "zh",
    });
    expect(initialized.status).toBe(0);
    expect(initialized.stdout).toContain("Developer 初始化完成：alice");
  });

  it("localizes developer errors but preserves raw developer output", () => {
    const missing = runScript("get_developer.py", [], {
      TRELLIS_LANGUAGE: "zh",
    });
    expect(missing.status).toBe(1);
    expect(missing.stdout).toBe("");
    expect(missing.stderr).toContain("Developer 尚未初始化");

    fs.writeFileSync(
      path.join(tmpDir, ".trellis", ".developer"),
      "name=alice\ninitialized_at=2026-07-27T00:00:00\n",
      "utf-8",
    );
    const present = runScript("get_developer.py", [], {
      TRELLIS_LANGUAGE: "zh",
    });
    expect(present.status).toBe(0);
    expect(present.stdout).toBe("alice\n");
    expect(present.stderr).toBe("");
  });

  it("keeps task current --source labels and create raw stdout stable in Chinese", () => {
    const current = runScript("task.py", ["current", "--source"], {
      TRELLIS_LANGUAGE: "zh",
    });
    expect(current.status).toBe(1);
    expect(current.stdout).toBe("Current task: (none)\nSource: none\n");

    fs.writeFileSync(
      path.join(tmpDir, ".trellis", ".developer"),
      "name=alice\ninitialized_at=2026-07-27T00:00:00\n",
      "utf-8",
    );
    const created = runScript(
      "task.py",
      ["create", "测试任务", "--slug", "stable-path"],
      { TRELLIS_LANGUAGE: "zh" },
    );
    expect(created.status).toBe(0);
    expect(created.stdout).toMatch(
      /^\.trellis\/tasks\/\d{2}-\d{2}-stable-path\n$/,
    );
    expect(created.stderr).toContain("已创建 task");
    expect(
      fs.readFileSync(path.join(tmpDir, created.stdout.trim(), "prd.md"), "utf-8"),
    ).toBe(`# 测试任务

## 目标

1. 待补充。

## 需求

- 待补充

## 用户可见结果

- [ ] 待补充
`);
  });

  it("preserves create/start/finish/archive lifecycle hooks while localizing Python prose", () => {
    installHookProbe();
    writeProjectFile(
      ".trellis/.developer",
      "name=alice\ninitialized_at=2026-07-27T00:00:00\n",
    );
    writeHookConfig({
      after_create: [hookCommand("after_create")],
      after_start: [hookCommand("after_start")],
      after_finish: [hookCommand("after_finish")],
      after_archive: [hookCommand("after_archive")],
    });
    const env = { TRELLIS_CONTEXT_ID: "python-i18n-lifecycle" };

    const created = runScript(
      "task.py",
      ["create", "Hook lifecycle", "--slug", "hook-lifecycle"],
      env,
    );
    expect(created.status).toBe(0);
    const taskPath = created.stdout.trim();
    expect(taskPath).toMatch(/^\.trellis\/tasks\/\d{2}-\d{2}-hook-lifecycle$/);

    const started = runScript("task.py", ["start", taskPath], env);
    expect(started.status).toBe(0);
    expect(started.stdout).toContain("Status：planning → in_progress");

    const finished = runScript("task.py", ["finish"], env);
    expect(finished.status).toBe(0);
    expect(finished.stdout).toContain("已清除 current task");

    const archived = runScript(
      "task.py",
      ["archive", taskPath, "--no-commit"],
      env,
    );
    expect(archived.status).toBe(0);
    expect(archived.stdout.trim()).toMatch(
      /^\.trellis\/tasks\/archive\/\d{4}-\d{2}\/\d{2}-\d{2}-hook-lifecycle$/,
    );

    for (const result of [created, started, finished, archived]) {
      expect(result.stdout).not.toContain("HOOK STDOUT");
      expect(result.stdout).not.toContain("HOOK STDERR");
      expect(result.stderr).not.toContain("HOOK STDOUT");
      expect(result.stderr).not.toContain("HOOK STDERR");
    }

    const events = readHookEvents();
    expect(events.map(({ event }) => event)).toEqual([
      "after_create",
      "after_start",
      "after_finish",
      "after_archive",
    ]);
    const canonicalTmpDir = fs.realpathSync(tmpDir);
    const originalTaskJson = path.join(canonicalTmpDir, taskPath, "task.json");
    expect(events.slice(0, 3).map(({ taskJsonPath }) => taskJsonPath)).toEqual([
      originalTaskJson,
      originalTaskJson,
      originalTaskJson,
    ]);
    expect(events[3]?.taskJsonPath).toBe(
      path.join(canonicalTmpDir, archived.stdout.trim(), "task.json"),
    );
    const archivedTask = JSON.parse(
      fs.readFileSync(events[3]?.taskJsonPath ?? "", "utf-8"),
    ) as { status?: string };
    expect(archivedTask.status).toBe("completed");
  });

  it("keeps task creation successful when one localized lifecycle hook fails", () => {
    installHookProbe();
    writeProjectFile(
      ".trellis/.developer",
      "name=alice\ninitialized_at=2026-07-27T00:00:00\n",
    );
    writeHookConfig({
      after_create: [hookCommand("fail"), hookCommand("after_create_recovery")],
    });

    const created = runScript(
      "task.py",
      ["create", "Failing hook", "--slug", "failing-hook"],
      { TRELLIS_CONTEXT_ID: "python-i18n-failing-hook" },
    );

    expect(created.status).toBe(0);
    expect(created.stdout).toMatch(
      /^\.trellis\/tasks\/\d{2}-\d{2}-failing-hook\n$/,
    );
    expect(created.stdout).not.toContain("HOOK STDOUT");
    expect(created.stderr).toContain("[WARN] Hook 失败（after_create）");
    expect(created.stderr).toContain("HOOK STDERR fail");
    expect(readHookEvents().map(({ event }) => event)).toEqual([
      "fail",
      "after_create_recovery",
    ]);
    expect(
      fs.existsSync(path.join(tmpDir, created.stdout.trim(), "task.json")),
    ).toBe(true);
  });

  it("keeps JSON schemas locale-neutral", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", ".developer"),
      "name=alice\ninitialized_at=2026-07-27T00:00:00\n",
      "utf-8",
    );
    const english = runScript("get_context.py", ["--json"], {
      TRELLIS_LANGUAGE: "en",
    });
    const chinese = runScript("get_context.py", ["--json"], {
      TRELLIS_LANGUAGE: "zh",
    });

    expect(english.status).toBe(0);
    expect(chinese.status).toBe(0);
    expect(Object.keys(JSON.parse(english.stdout) as object)).toEqual(
      Object.keys(JSON.parse(chinese.stdout) as object),
    );
  });

  it("falls back from Chinese to English and finally to the visible key", () => {
    const code = [
      "from common import i18n",
      "i18n.set_locale('zh')",
      "i18n._loaded_strings['zh'].pop('task.arg_title')",
      "print(i18n.t('task.arg_title'))",
      "print(i18n.t('missing.everywhere'))",
    ].join("; ");
    const result = spawnSync(pythonCommand, ["-c", code], {
      cwd: scriptsDir,
      encoding: "utf-8",
      env: cleanEnv(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("Task title\nmissing.everywhere\n");
  });
});

describe("i18n drift checker CLI Python bundle validation", () => {
  let tmpDir: string;
  let packageRoot: string;
  let checkerPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-i18n-drift-cli-"));
    packageRoot = path.join(tmpDir, "package");
    checkerPath = path.join(packageRoot, "scripts", "check-i18n-drift.js");

    fs.mkdirSync(path.dirname(checkerPath), { recursive: true });
    fs.copyFileSync(
      new URL("../../scripts/check-i18n-drift.js", import.meta.url),
      checkerPath,
    );
    // macOS exposes the temp directory as /var while import.meta.url resolves
    // it through /private/var. Use the canonical path so the script's direct-
    // execution guard recognizes this spawned CLI invocation.
    checkerPath = fs.realpathSync(checkerPath);

    const templatesDir = path.join(packageRoot, "src", "templates");
    fs.mkdirSync(templatesDir, { recursive: true });
    fs.writeFileSync(path.join(templatesDir, "sample.md"), "# English\n");
    fs.writeFileSync(path.join(templatesDir, "sample.zh.md"), "# 中文\n");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writePythonBundles(
    english: Record<string, string>,
    chinese: Record<string, string>,
  ): void {
    const bundleDir = path.join(
      packageRoot,
      "src",
      "templates",
      "trellis",
      "scripts",
      "common",
      "i18n_strings",
    );
    fs.mkdirSync(bundleDir, { recursive: true });
    fs.writeFileSync(
      path.join(bundleDir, "en.py"),
      `STRINGS = ${JSON.stringify(english, null, 2)}\n`,
      "utf-8",
    );
    fs.writeFileSync(
      path.join(bundleDir, "zh.py"),
      `STRINGS = ${JSON.stringify(chinese, null, 2)}\n`,
      "utf-8",
    );
  }

  function runChecker(args: string[] = []): SpawnSyncReturns<string> {
    return spawnSync(process.execPath, [checkerPath, ...args], {
      cwd: packageRoot,
      encoding: "utf-8",
      env: cleanEnv(),
    });
  }

  it.each([
    {
      name: "missing localized key",
      english: { shared: "Hello {name}", missing: "Missing" },
      chinese: { shared: "你好 {name}" },
      diagnostic: "missing localized key: missing",
    },
    {
      name: "orphan localized key",
      english: { shared: "Hello {name}" },
      chinese: { shared: "你好 {name}", orphan: "孤立" },
      diagnostic: "orphan localized key: orphan",
    },
    {
      name: "placeholder mismatch",
      english: { shared: "Hello {name}" },
      chinese: { shared: "你好 {user}" },
      diagnostic: "Python placeholder mismatch: shared",
    },
  ])(
    "reports $name without failing by default and fails under --strict",
    ({ english, chinese, diagnostic }) => {
      writePythonBundles(english, chinese);

      const warningOnly = runChecker();
      const strict = runChecker(["--strict"]);

      expect(warningOnly.status).toBe(0);
      expect(warningOnly.stderr).toContain(
        "[i18n] Python string bundle mismatch:",
      );
      expect(warningOnly.stderr).toContain(diagnostic);
      expect(warningOnly.stdout).toContain("1 Python issue(s)");

      expect(strict.status).toBe(1);
      expect(strict.stderr).toContain(
        "[i18n] Python string bundle mismatch:",
      );
      expect(strict.stderr).toContain(diagnostic);
      expect(strict.stdout).toContain("1 Python issue(s)");
    },
  );
});

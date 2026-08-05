/**
 * Integration tests for the Story parent naming contract in task.py.
 *
 * The test stamps the shipped Python templates into a fresh repository and
 * exercises the real `create --parent` and `add-subtask` command paths.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEMPLATE_SCRIPTS = path.resolve(
  __dirname,
  "../../src/templates/trellis/scripts",
);
const DEVELOPER = "tester";

function hasPython(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function setupRepo(tmp: string): void {
  fs.mkdirSync(tmp, { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(tmp, ".trellis", "scripts"), {
    recursive: true,
  });
  const result = spawnSync(
    "python3",
    [".trellis/scripts/init_developer.py", DEVELOPER],
    { cwd: tmp, encoding: "utf-8" },
  );
  if (result.status !== 0) {
    throw new Error(`init_developer failed: ${result.stderr}`);
  }
}

function runTask(repo: string, ...args: string[]) {
  return spawnSync("python3", [".trellis/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
  });
}

function findTaskDir(repo: string, slug: string): string {
  const dir = fs
    .readdirSync(path.join(repo, ".trellis", "tasks"))
    .find((name) => name.endsWith(`-${slug}`));
  if (!dir) {
    throw new Error(`task directory not found for ${slug}`);
  }
  return dir;
}

function readTaskJson(repo: string, dir: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(
      path.join(repo, ".trellis", "tasks", dir, "task.json"),
      "utf-8",
    ),
  );
}

function makeTask(
  repo: string,
  dir: string,
  data: Record<string, unknown>,
): void {
  const taskDir = path.join(repo, ".trellis", "tasks", dir);
  fs.mkdirSync(taskDir, { recursive: true });
  fs.writeFileSync(path.join(taskDir, "prd.md"), "# task\n");
  fs.writeFileSync(path.join(taskDir, "task.json"), JSON.stringify(data));
}

describe.skipIf(!hasPython())("task.py Story parent naming", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-story-parent-test-"));
    setupRepo(tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("creates a child only when its parent has a story slug", () => {
    expect(
      runTask(
        tmp,
        "create",
        "release Story",
        "--slug",
        "story-release-diff",
        "--no-start",
      ).status,
    ).toBe(0);
    const parentDir = findTaskDir(tmp, "story-release-diff");

    const childResult = runTask(
      tmp,
      "create",
      "compare outputs",
      "--slug",
      "compare-outputs",
      "--parent",
      `.trellis/tasks/${parentDir}`,
      "--no-start",
    );
    expect(childResult.status).toBe(0);

    const childDir = findTaskDir(tmp, "compare-outputs");
    expect(readTaskJson(tmp, childDir).parent).toBe(parentDir);
    expect(readTaskJson(tmp, parentDir).children).toEqual([childDir]);
  });

  it("rejects create --parent before creating a child for a non-Story parent", () => {
    expect(
      runTask(
        tmp,
        "create",
        "ordinary task",
        "--slug",
        "ordinary-task",
        "--no-start",
      ).status,
    ).toBe(0);
    const parentDir = findTaskDir(tmp, "ordinary-task");

    const result = runTask(
      tmp,
      "create",
      "blocked child",
      "--slug",
      "blocked-child",
      "--parent",
      `.trellis/tasks/${parentDir}`,
      "--no-start",
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("story-<business-short-name>");
    expect(fs.readdirSync(path.join(tmp, ".trellis", "tasks"))).not.toContain(
      expect.stringMatching(/blocked-child$/),
    );
    expect(readTaskJson(tmp, parentDir).children).toEqual([]);
  });

  it("rejects a bare story prefix as a parent slug", () => {
    expect(
      runTask(
        tmp,
        "create",
        "unfinished Story",
        "--slug",
        "story-",
        "--no-start",
      ).status,
    ).toBe(0);
    const parentDir = findTaskDir(tmp, "story-");

    const result = runTask(
      tmp,
      "create",
      "blocked child",
      "--slug",
      "blocked-child",
      "--parent",
      `.trellis/tasks/${parentDir}`,
      "--no-start",
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("story-<business-short-name>");
  });

  it("cannot bypass the naming contract through add-subtask", () => {
    expect(
      runTask(
        tmp,
        "create",
        "ordinary task",
        "--slug",
        "ordinary-task",
        "--no-start",
      ).status,
    ).toBe(0);
    expect(
      runTask(
        tmp,
        "create",
        "candidate child",
        "--slug",
        "candidate-child",
        "--no-start",
      ).status,
    ).toBe(0);
    const parentDir = findTaskDir(tmp, "ordinary-task");
    const childDir = findTaskDir(tmp, "candidate-child");

    const result = runTask(
      tmp,
      "add-subtask",
      `.trellis/tasks/${parentDir}`,
      `.trellis/tasks/${childDir}`,
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("story-<business-short-name>");
    expect(readTaskJson(tmp, parentDir).children).toEqual([]);
    expect(readTaskJson(tmp, childDir).parent).toBeNull();
  });

  it("links an existing child through add-subtask for a Story parent", () => {
    expect(
      runTask(
        tmp,
        "create",
        "release Story",
        "--slug",
        "story-release-diff",
        "--no-start",
      ).status,
    ).toBe(0);
    expect(
      runTask(
        tmp,
        "create",
        "candidate child",
        "--slug",
        "candidate-child",
        "--no-start",
      ).status,
    ).toBe(0);
    const parentDir = findTaskDir(tmp, "story-release-diff");
    const childDir = findTaskDir(tmp, "candidate-child");

    const result = runTask(
      tmp,
      "add-subtask",
      `.trellis/tasks/${parentDir}`,
      `.trellis/tasks/${childDir}`,
    );
    expect(result.status).toBe(0);
    expect(readTaskJson(tmp, parentDir).children).toEqual([childDir]);
    expect(readTaskJson(tmp, childDir).parent).toBe(parentDir);
  });

  it("continues to list an existing non-Story tree without migration", () => {
    makeTask(tmp, "01-01-legacy-parent", {
      id: "legacy-parent",
      name: "legacy-parent",
      title: "legacy parent",
      status: "planning",
      priority: "P2",
      createdAt: "2026-01-01",
      assignee: DEVELOPER,
      creator: DEVELOPER,
      children: ["01-01-legacy-child"],
      parent: null,
    });
    makeTask(tmp, "01-01-legacy-child", {
      id: "legacy-child",
      name: "legacy-child",
      title: "legacy child",
      status: "planning",
      priority: "P2",
      createdAt: "2026-01-01",
      assignee: DEVELOPER,
      creator: DEVELOPER,
      children: [],
      parent: "01-01-legacy-parent",
    });

    const result = runTask(tmp, "list");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("01-01-legacy-parent/");
    expect(result.stdout).toContain("01-01-legacy-child/");
  });
});

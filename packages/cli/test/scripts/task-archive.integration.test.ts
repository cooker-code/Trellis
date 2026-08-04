/**
 * Integration tests for `task.py archive` auto-commit behavior.
 *
 * The python script lives under
 * `src/templates/trellis/scripts/common/task_store.py`; this test stamps
 * the templates into a fresh git repo and exercises the real `python3
 * task.py archive` path. Two scenarios:
 *
 *   1. Scope-creep — archive must NOT bundle dirty changes from OTHER
 *      active task dirs into the archive commit.
 *   2. Phantom-delete — after `shutil.move` of a tracked task dir, the
 *      source-side deletions must land in the archive commit (so the
 *      working tree stays clean against HEAD).
 *   3. Commit-failure visibility — if the archive move succeeds but git
 *      cannot create the bookkeeping commit, `task.py archive` must fail
 *      loudly so callers do not continue to journal over dirty deletes.
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

function hasPython(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  if (r.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed (rc=${r.status}): ${r.stderr}`,
    );
  }
  return r.stdout.trim();
}

function setupRepo(tmp: string): void {
  fs.mkdirSync(tmp, { recursive: true });
  git(tmp, "init", "-q", "-b", "main");
  // Local commit identity so commit() works in CI without global config.
  git(tmp, "config", "user.email", "test@example.com");
  git(tmp, "config", "user.name", "Test");

  // Stamp the real templates into the test repo.
  const scriptsDest = path.join(tmp, ".trellis", "scripts");
  fs.mkdirSync(scriptsDest, { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, scriptsDest, { recursive: true });

  // session_auto_commit must be enabled for the archive to commit.
  fs.writeFileSync(
    path.join(tmp, ".trellis", "config.yaml"),
    "session_auto_commit: true\n",
  );
}

function makeTask(repo: string, name: string, prdBody: string): void {
  const dir = path.join(repo, ".trellis", "tasks", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "prd.md"), prdBody);
  fs.writeFileSync(
    path.join(dir, "task.json"),
    JSON.stringify({
      id: name,
      name,
      title: name,
      status: "in_progress",
      priority: "P2",
      createdAt: "2026-05-13",
      assignee: "test",
      creator: "test",
      subtasks: [],
      children: [],
      relatedFiles: [],
      meta: {},
    }) + "\n",
  );
}

function runArchive(repo: string, taskName: string): void {
  const r = spawnSync(
    "python3",
    [".trellis/scripts/task.py", "archive", taskName],
    { cwd: repo, encoding: "utf-8" },
  );
  if (r.status !== 0) {
    throw new Error(`archive failed: ${r.stderr}`);
  }
}

function runTaskJson(repo: string, ...args: string[]): Record<string, unknown> {
  const r = spawnSync(
    "python3",
    [".trellis/scripts/task.py", ...args],
    { cwd: repo, encoding: "utf-8" },
  );
  if (r.status !== 0) {
    throw new Error(`task.py ${args.join(" ")} failed: ${r.stderr}`);
  }
  return JSON.parse(r.stdout) as Record<string, unknown>;
}

function runTask(repo: string, ...args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("python3", [".trellis/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
  });
}

function blockedReceipt(result: ReturnType<typeof runTask>): Record<string, unknown> {
  expect(result.status).toBe(1);
  expect(result.stdout).not.toBe("");
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function setDeliveryTask(
  repo: string,
  name: string,
  branch: string,
  worktreePath?: string,
): string {
  makeTask(repo, name, `# ${name}\n`);
  const taskPath = path.join(repo, ".trellis", "tasks", name, "task.json");
  const task = JSON.parse(fs.readFileSync(taskPath, "utf-8")) as Record<string, unknown>;
  task.branch = branch;
  task.base_branch = "main";
  if (worktreePath) task.worktree_path = worktreePath;
  fs.writeFileSync(taskPath, `${JSON.stringify(task)}\n`);
  return taskPath;
}

function addWorktree(
  repo: string,
  worktreePath: string,
  branch: string,
  createBranch?: string,
): void {
  const args = ["worktree", "add", "--quiet"];
  if (createBranch) args.push("-b", createBranch);
  git(repo, ...args, worktreePath, branch);
}

describe.skipIf(!hasPython())(
  "task.py archive auto-commit",
  () => {
    let tmp: string;

    beforeEach(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-archive-test-"));
      setupRepo(tmp);
    });

    afterEach(() => {
      const parent = path.dirname(tmp);
      const prefix = `${path.basename(tmp)}-worktree-`;
      for (const entry of fs.readdirSync(parent)) {
        if (entry.startsWith(prefix)) {
          fs.rmSync(path.join(parent, entry), { recursive: true, force: true });
        }
      }
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    it("does not bundle dirty changes from other task dirs (scope-creep fix)", () => {
      makeTask(tmp, "task-a", "task A prd\n");
      makeTask(tmp, "task-b", "task B prd v1\n");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");

      // Dirty edit in task-b BEFORE archiving task-a.
      fs.appendFileSync(
        path.join(tmp, ".trellis", "tasks", "task-b", "prd.md"),
        "DIRTY EDIT IN TASK-B SHOULD NOT BE COMMITTED\n",
      );

      runArchive(tmp, "task-a");

      // Last commit: which files?
      const lastFiles = git(
        tmp,
        "show",
        "HEAD",
        "--name-only",
        "--pretty=format:",
      )
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      // task-b paths must NOT appear in the archive commit.
      const leaked = lastFiles.filter((f) => f.includes("/task-b/"));
      expect(leaked).toEqual([]);

      // task-b dirty change still in working tree.
      const status = git(tmp, "status", "--porcelain");
      expect(status).toMatch(/M\s+\.trellis\/tasks\/task-b\/prd\.md/);
    });

    it(
      "stages source-side deletions in the archive commit (phantom-delete fix)",
      () => {
        makeTask(tmp, "big", "# big task\n");
        // Add many files under research/ to mimic the production case that
        // surfaced the bug.
        const researchDir = path.join(
          tmp,
          ".trellis",
          "tasks",
          "big",
          "research",
        );
        fs.mkdirSync(researchDir, { recursive: true });
        for (let i = 0; i < 100; i++) {
          fs.writeFileSync(
            path.join(researchDir, `file-${i}.json`),
            `{"n":${i}}\n`,
          );
        }
        git(tmp, "add", "-A");
        git(tmp, "commit", "-q", "-m", "initial");

        runArchive(tmp, "big");

        // Working tree must be clean (no phantom deletes against HEAD).
        const status = git(tmp, "status", "--porcelain");
        const meaningful = status
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((s) => !s.includes("__pycache__")); // ignore .pyc noise
        expect(meaningful).toEqual([]);

        // Archive commit has deletions at the source location.
        const deletes = git(
          tmp,
          "show",
          "HEAD",
          "--diff-filter=D",
          "--name-only",
          "--pretty=format:",
        )
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        expect(deletes.length).toBeGreaterThan(0);
        expect(
          deletes.every((p) => p.startsWith(".trellis/tasks/big/")),
        ).toBe(true);
      },
      30_000, // python startup + 100-file ops can be slow
    );

    it("refuses to archive a mistyped name that resolves to a real source dir", () => {
      makeTask(tmp, "real-task", "# real task\n");
      // A user source directory that is NOT a task.
      const srcDir = path.join(tmp, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, "index.ts"), "export const x = 1;\n");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");

      // Typo: `archive src` instead of a task name. resolve_task_dir falls
      // back to repo_root/src; without the guard this moves the whole source
      // dir into .trellis/tasks/archive/.
      const r = spawnSync(
        "python3",
        [".trellis/scripts/task.py", "archive", "src"],
        { cwd: tmp, encoding: "utf-8" },
      );

      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("refusing to archive");
      // src/ untouched, still at its original location with its file.
      expect(fs.existsSync(path.join(srcDir, "index.ts"))).toBe(true);
      // No archive dir was created holding a moved src.
      expect(
        fs.existsSync(
          path.join(tmp, ".trellis", "tasks", "archive"),
        ),
      ).toBe(false);
    });

    it("fails when archive auto-commit cannot record tracked source deletes", () => {
      makeTask(tmp, "tracked", "# tracked task\n");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");

      // Simulate a repo where git can stage the archive move but cannot
      // create the commit. A failing hook is deterministic even when the
      // developer machine has global git identity configured.
      const hookPath = path.join(tmp, ".git", "hooks", "pre-commit");
      fs.writeFileSync(
        hookPath,
        "#!/bin/sh\necho archive commit blocked >&2\nexit 1\n",
      );
      fs.chmodSync(hookPath, 0o755);

      const r = spawnSync(
        "python3",
        [".trellis/scripts/task.py", "archive", "tracked"],
        { cwd: tmp, encoding: "utf-8" },
      );

      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("Archive moved on disk");
      expect(r.stderr).toContain("Auto-commit failed");

      const status = git(tmp, "status", "--porcelain");
      expect(status).toContain(".trellis/tasks/tracked/");
      expect(status).toContain(".trellis/tasks/archive/");
    });

    it("reports a versioned delivery receipt without changing a pending feature branch", () => {
      makeTask(tmp, "delivery", "# delivery\n");
      const taskPath = path.join(tmp, ".trellis", "tasks", "delivery", "task.json");
      const task = JSON.parse(fs.readFileSync(taskPath, "utf-8")) as Record<string, unknown>;
      task.branch = "feature/delivery";
      task.base_branch = "main";
      fs.writeFileSync(taskPath, `${JSON.stringify(task)}\n`);
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      git(tmp, "checkout", "-q", "-b", "feature/delivery");
      fs.writeFileSync(path.join(tmp, "feature.txt"), "feature\n");
      git(tmp, "add", "feature.txt");
      git(tmp, "commit", "-q", "-m", "feature");
      const featureTip = git(tmp, "rev-parse", "HEAD");
      git(tmp, "checkout", "-q", "main");

      const result = runTaskJson(tmp, "delivery-status", "delivery", "--json");

      expect(result.schema_version).toBe("trellis-git-delivery.v1");
      expect((result.feature as Record<string, unknown>).branch).toBe("feature/delivery");
      expect((result.feature as Record<string, unknown>).head).toBe(featureTip);
      expect((result.integration as Record<string, unknown>).state).toBe("integration_pending");
      expect(result.allowed_modes).toEqual(["local-merge", "pr", "retain"]);
      expect(git(tmp, "rev-parse", "main")).not.toBe(featureTip);
    });

    it("records retain as an explicit receipt without modifying Git", () => {
      makeTask(tmp, "retain", "# retain\n");
      const taskPath = path.join(tmp, ".trellis", "tasks", "retain", "task.json");
      const task = JSON.parse(fs.readFileSync(taskPath, "utf-8")) as Record<string, unknown>;
      task.branch = "feature/retain";
      task.base_branch = "main";
      fs.writeFileSync(taskPath, `${JSON.stringify(task)}\n`);
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      git(tmp, "checkout", "-q", "-b", "feature/retain");
      fs.writeFileSync(path.join(tmp, "retain.txt"), "retain\n");
      git(tmp, "add", "retain.txt");
      git(tmp, "commit", "-q", "-m", "retain");
      git(tmp, "checkout", "-q", "main");
      const before = git(tmp, "rev-parse", "HEAD");

      const result = runTaskJson(tmp, "deliver", "retain", "--mode", "retain", "--reason", "manual review", "--json");

      expect(result.schema_version).toBe("trellis-git-delivery.v1");
      expect((result.integration as Record<string, unknown>).state).toBe("retained");
      expect(git(tmp, "rev-parse", "HEAD")).toBe(before);
      const stored = JSON.parse(fs.readFileSync(taskPath, "utf-8")) as Record<string, unknown>;
      expect(stored.delivery_retention_reason).toBe("manual review");
      expect(stored.commit).toBe(git(tmp, "rev-parse", "feature/retain"));
    });

    it("returns a structured PR refusal on stdout when no remote exists", () => {
      setDeliveryTask(tmp, "pr-blocked", "feature/pr-blocked");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      git(tmp, "branch", "feature/pr-blocked");

      const result = runTask(tmp, "deliver", "pr-blocked", "--mode", "pr", "--json");

      const receipt = blockedReceipt(result);
      expect(receipt.operation).toEqual({
        mode: "pr",
        state: "blocked",
        reason: "remote_unavailable",
      });
      expect(result.stderr).toBe("");
    });

    it("returns exactly one local-only JSON receipt for PR dry-run", () => {
      setDeliveryTask(tmp, "pr-dry-run", "feature/pr-dry-run");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      git(tmp, "checkout", "-q", "-b", "feature/pr-dry-run");
      fs.writeFileSync(path.join(tmp, "pr.txt"), "pr\n");
      git(tmp, "add", "pr.txt");
      git(tmp, "commit", "-q", "-m", "pr feature");
      git(tmp, "checkout", "-q", "main");
      git(tmp, "remote", "add", "origin", "https://example.invalid/repo.git");
      const before = git(tmp, "rev-parse", "HEAD");

      const result = runTask(tmp, "deliver", "pr-dry-run", "--mode", "pr", "--json");

      expect(result.status).toBe(0);
      const lines = result.stdout.trim().split("\n");
      expect(lines).toHaveLength(1);
      const receipt = JSON.parse(lines[0]) as Record<string, unknown>;
      expect(receipt.schema_version).toBe("trellis-git-delivery.v1");
      expect(receipt.operation).toEqual({
        mode: "pr",
        state: "dry_run",
        dry_run: true,
        push: false,
      });
      expect(git(tmp, "rev-parse", "HEAD")).toBe(before);
    });

    it("fast-forwards only after this invocation explicitly authorizes local merge", () => {
      makeTask(tmp, "merge", "# merge\n");
      const taskPath = path.join(tmp, ".trellis", "tasks", "merge", "task.json");
      const task = JSON.parse(fs.readFileSync(taskPath, "utf-8")) as Record<string, unknown>;
      task.branch = "feature/merge";
      task.base_branch = "main";
      fs.writeFileSync(taskPath, `${JSON.stringify(task)}\n`);
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      git(tmp, "checkout", "-q", "-b", "feature/merge");
      fs.writeFileSync(path.join(tmp, "merge.txt"), "merge\n");
      git(tmp, "add", "merge.txt");
      git(tmp, "commit", "-q", "-m", "merge");
      const featureTip = git(tmp, "rev-parse", "HEAD");
      git(tmp, "checkout", "-q", "main");

      const result = runTaskJson(tmp, "deliver", "merge", "--mode", "local-merge", "--authorize", "--json");

      expect(git(tmp, "rev-parse", "main")).toBe(featureTip);
      expect((result.integration as Record<string, unknown>).state).toBe("integrated");

      const cleanup = runTaskJson(tmp, "delivery-cleanup", "merge", "--delete-branch", "--authorize", "--json");
      expect((cleanup.integration as Record<string, unknown>).state).toBe("integrated");
      expect(cleanup.cleanup).toEqual({ worktree: "not_recorded", branch: "deleted" });
      const deleted = spawnSync("git", ["show-ref", "--verify", "--quiet", "refs/heads/feature/merge"], { cwd: tmp });
      expect(deleted.status).not.toBe(0);
      const after = runTaskJson(tmp, "delivery-status", "merge", "--json");
      expect((after.integration as Record<string, unknown>).state).toBe("integrated");
      expect((after.feature as Record<string, unknown>).task_commit).toBe(featureTip);
    });

    it("blocks a recorded task commit that no longer matches its feature tip", () => {
      const taskPath = setDeliveryTask(tmp, "stale-commit", "feature/stale-commit");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      const recorded = git(tmp, "rev-parse", "HEAD");
      git(tmp, "checkout", "-q", "-b", "feature/stale-commit");
      fs.writeFileSync(path.join(tmp, "later.txt"), "later\n");
      git(tmp, "add", "later.txt");
      git(tmp, "commit", "-q", "-m", "later feature work");
      const featureTip = git(tmp, "rev-parse", "HEAD");
      const task = JSON.parse(fs.readFileSync(taskPath, "utf-8")) as Record<string, unknown>;
      task.commit = recorded;
      fs.writeFileSync(taskPath, `${JSON.stringify(task)}\n`);
      git(tmp, "checkout", "-q", "main");
      const mainBefore = git(tmp, "rev-parse", "HEAD");

      const receipt = runTaskJson(tmp, "delivery-status", "stale-commit", "--json");
      expect((receipt.integration as Record<string, unknown>).state).toBe("integration_blocked");
      expect((receipt.integration as Record<string, unknown>).conflict_state).toBe("task_commit_mismatch");
      const block = blockedReceipt(runTask(tmp, "deliver", "stale-commit", "--mode", "local-merge", "--authorize", "--json"));
      expect((block.operation as Record<string, unknown>).reason).toBe("delivery_state_unavailable");
      expect(git(tmp, "rev-parse", "main")).toBe(mainBefore);
      expect(git(tmp, "rev-parse", "feature/stale-commit")).toBe(featureTip);
    });

    it("degrades missing delivery metadata without changing Git", () => {
      makeTask(tmp, "legacy", "# legacy\n");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      const before = git(tmp, "rev-parse", "HEAD");
      const receipt = runTaskJson(tmp, "delivery-status", "legacy", "--json");
      expect((receipt.integration as Record<string, unknown>).state).toBe("no_code_change");
      expect(git(tmp, "rev-parse", "HEAD")).toBe(before);
    });

    it("reports uncommitted linked-worktree changes without touching either branch", () => {
      const linked = `${tmp}-worktree-uncommitted`;
      setDeliveryTask(tmp, "uncommitted", "feature/uncommitted", linked);
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      addWorktree(tmp, linked, "main", "feature/uncommitted");
      fs.writeFileSync(path.join(linked, "dirty.txt"), "not committed\n");
      const mainBefore = git(tmp, "rev-parse", "main");
      const featureBefore = git(tmp, "rev-parse", "feature/uncommitted");

      const receipt = runTaskJson(tmp, "delivery-status", "uncommitted", "--json");

      expect((receipt.integration as Record<string, unknown>).state).toBe("uncommitted");
      expect((receipt.worktree as Record<string, unknown>).dirty_count).toBe(1);
      expect(git(tmp, "rev-parse", "main")).toBe(mainBefore);
      expect(git(tmp, "rev-parse", "feature/uncommitted")).toBe(featureBefore);
    });

    it("reports a conflict as a structured block without changing the base", () => {
      setDeliveryTask(tmp, "conflict", "feature/conflict");
      fs.writeFileSync(path.join(tmp, "shared.txt"), "base\n");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      git(tmp, "checkout", "-q", "-b", "feature/conflict");
      fs.writeFileSync(path.join(tmp, "shared.txt"), "feature\n");
      git(tmp, "commit", "-qam", "feature change");
      const featureTip = git(tmp, "rev-parse", "HEAD");
      git(tmp, "checkout", "-q", "main");
      fs.writeFileSync(path.join(tmp, "shared.txt"), "main\n");
      git(tmp, "commit", "-qam", "main change");
      const mainBefore = git(tmp, "rev-parse", "HEAD");

      const receipt = runTaskJson(tmp, "delivery-status", "conflict", "--json");

      expect((receipt.integration as Record<string, unknown>).state).toBe("integration_blocked");
      expect((receipt.integration as Record<string, unknown>).conflict_state).toBe("conflict");
      expect(receipt.allowed_modes).toEqual(["pr", "retain"]);
      expect(git(tmp, "rev-parse", "main")).toBe(mainBefore);
      expect(git(tmp, "rev-parse", "feature/conflict")).toBe(featureTip);
    });

    it("blocks an authorized merge into a dirty target with a structured reason", () => {
      setDeliveryTask(tmp, "dirty-target", "feature/dirty-target");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      git(tmp, "checkout", "-q", "-b", "feature/dirty-target");
      fs.writeFileSync(path.join(tmp, "feature.txt"), "feature\n");
      git(tmp, "add", "feature.txt");
      git(tmp, "commit", "-q", "-m", "feature");
      const featureTip = git(tmp, "rev-parse", "HEAD");
      git(tmp, "checkout", "-q", "main");
      fs.writeFileSync(path.join(tmp, "dirty-target.txt"), "dirty\n");
      const mainBefore = git(tmp, "rev-parse", "HEAD");

      const block = blockedReceipt(runTask(tmp, "deliver", "dirty-target", "--mode", "local-merge", "--authorize", "--json"));

      expect((block.operation as Record<string, unknown>).state).toBe("blocked");
      expect((block.operation as Record<string, unknown>).reason).toBe("dirty_target_worktree");
      expect(git(tmp, "rev-parse", "main")).toBe(mainBefore);
      expect(git(tmp, "rev-parse", "feature/dirty-target")).toBe(featureTip);
      expect(fs.existsSync(path.join(tmp, "dirty-target.txt"))).toBe(true);
    });

    it("blocks linked-worktree cleanup when another session owns that exact worktree", () => {
      const linked = `${tmp}-worktree-parallel`;
      const taskPath = setDeliveryTask(tmp, "parallel", "feature/parallel", linked);
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      addWorktree(tmp, linked, "main", "feature/parallel");
      git(tmp, "merge", "--ff-only", "feature/parallel");
      const sessions = path.join(tmp, ".trellis", ".runtime", "sessions");
      fs.mkdirSync(sessions, { recursive: true });
      fs.writeFileSync(path.join(sessions, "other.json"), JSON.stringify({ task_dir: path.dirname(taskPath), worktree_path: fs.realpathSync(linked) }));

      const block = blockedReceipt(runTask(tmp, "delivery-cleanup", "parallel", "--remove-worktree", "--authorize", "--json"));

      expect((block.operation as Record<string, unknown>).reason).toBe("parallel_session_reference");
      expect(fs.existsSync(linked)).toBe(true);
      expect(git(tmp, "worktree", "list", "--porcelain")).toContain(`worktree ${fs.realpathSync(linked)}`);
    });

    it("blocks detached and submodule worktree removal without forcing either path", () => {
      const detached = `${tmp}-worktree-detached`;
      setDeliveryTask(tmp, "detached", "main", detached);
      fs.writeFileSync(path.join(tmp, ".gitmodules"), "[submodule \"fixture\"]\n");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      git(tmp, "worktree", "add", "--quiet", "--detach", detached, "HEAD");

      const submoduleBlock = blockedReceipt(runTask(tmp, "delivery-cleanup", "detached", "--remove-worktree", "--authorize", "--json"));
      expect((submoduleBlock.operation as Record<string, unknown>).reason).toBe("submodule_worktree");
      expect(fs.existsSync(detached)).toBe(true);

      git(tmp, "rm", "-q", ".gitmodules");
      git(tmp, "commit", "-q", "-m", "remove submodule fixture");
      const detachedOnly = `${tmp}-worktree-detached-only`;
      setDeliveryTask(tmp, "detached-only", "main", detachedOnly);
      git(tmp, "worktree", "add", "--quiet", "--detach", detachedOnly, "HEAD");
      const detachedBlock = blockedReceipt(runTask(tmp, "delivery-cleanup", "detached-only", "--remove-worktree", "--authorize", "--json"));
      expect((detachedBlock.operation as Record<string, unknown>).reason).toBe("detached_head");
      expect(fs.existsSync(detachedOnly)).toBe(true);
    });

    it("blocks prunable registration cleanup and leaves its Git registration intact", () => {
      const linked = `${tmp}-worktree-prunable`;
      setDeliveryTask(tmp, "prunable", "feature/prunable", linked);
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      addWorktree(tmp, linked, "main", "feature/prunable");
      git(tmp, "merge", "--ff-only", "feature/prunable");
      fs.rmSync(linked, { recursive: true, force: true });

      const block = blockedReceipt(runTask(tmp, "delivery-cleanup", "prunable", "--remove-worktree", "--authorize", "--json"));

      expect((block.operation as Record<string, unknown>).reason).toBe("prunable_worktree_registration");
      expect(git(tmp, "worktree", "list", "--porcelain")).toContain(`worktree ${fs.realpathSync(tmp)}-worktree-prunable`);
      expect(git(tmp, "worktree", "list", "--porcelain")).toContain("prunable");
    });

    it("blocks deleting a feature branch checked out by another linked worktree", () => {
      const linked = `${tmp}-worktree-same-branch`;
      setDeliveryTask(tmp, "same-branch", "feature/same-branch");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      git(tmp, "checkout", "-q", "-b", "feature/same-branch");
      fs.writeFileSync(path.join(tmp, "feature.txt"), "feature\n");
      git(tmp, "add", "feature.txt");
      git(tmp, "commit", "-q", "-m", "feature");
      const featureTip = git(tmp, "rev-parse", "HEAD");
      git(tmp, "checkout", "-q", "main");
      git(tmp, "merge", "--ff-only", "feature/same-branch");
      addWorktree(tmp, linked, "feature/same-branch");

      const block = blockedReceipt(runTask(tmp, "delivery-cleanup", "same-branch", "--delete-branch", "--authorize", "--json"));

      expect((block.operation as Record<string, unknown>).reason).toBe("feature_branch_checked_out");
      expect(git(tmp, "rev-parse", "feature/same-branch")).toBe(featureTip);
      expect(fs.existsSync(linked)).toBe(true);
    });

    it("removes only an explicitly authorized clean linked worktree", () => {
      const linked = `${tmp}-worktree-remove`;
      setDeliveryTask(tmp, "remove", "feature/remove", linked);
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      addWorktree(tmp, linked, "main", "feature/remove");
      git(tmp, "merge", "--ff-only", "feature/remove");
      const featureTip = git(tmp, "rev-parse", "feature/remove");

      const receipt = runTaskJson(tmp, "delivery-cleanup", "remove", "--remove-worktree", "--authorize", "--json");

      expect((receipt.integration as Record<string, unknown>).state).toBe("integrated");
      expect((receipt.cleanup as Record<string, unknown>).worktree).toBe("removed");
      expect(fs.existsSync(linked)).toBe(false);
      expect(git(tmp, "worktree", "list", "--porcelain")).not.toContain(`worktree ${linked}`);
      expect(git(tmp, "rev-parse", "feature/remove")).toBe(featureTip);
    });

    it("does not mistake the active task pointer for a parallel worktree owner", () => {
      const linked = `${tmp}-worktree-active-session`;
      const taskPath = setDeliveryTask(tmp, "active-session", "feature/active-session", linked);
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      addWorktree(tmp, linked, "main", "feature/active-session");
      git(tmp, "merge", "--ff-only", "feature/active-session");
      const sessions = path.join(tmp, ".trellis", ".runtime", "sessions");
      fs.mkdirSync(sessions, { recursive: true });
      fs.writeFileSync(path.join(sessions, "current.json"), JSON.stringify({ current_task: taskPath }));

      runTaskJson(tmp, "delivery-cleanup", "active-session", "--remove-worktree", "--authorize", "--json");

      expect(fs.existsSync(linked)).toBe(false);
    });

    it("can remove a clean worktree and delete its integrated branch when both are separately requested", () => {
      const linked = `${tmp}-worktree-remove-and-delete`;
      setDeliveryTask(tmp, "remove-and-delete", "feature/remove-and-delete", linked);
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");
      addWorktree(tmp, linked, "main", "feature/remove-and-delete");
      git(tmp, "merge", "--ff-only", "feature/remove-and-delete");

      const receipt = runTaskJson(tmp, "delivery-cleanup", "remove-and-delete", "--remove-worktree", "--delete-branch", "--authorize", "--json");

      expect(fs.existsSync(linked)).toBe(false);
      expect(spawnSync("git", ["show-ref", "--verify", "--quiet", "refs/heads/feature/remove-and-delete"], { cwd: tmp }).status).not.toBe(0);
      expect((receipt.integration as Record<string, unknown>).state).toBe("integrated");
      expect(receipt.cleanup).toEqual({ worktree: "removed", branch: "deleted" });
    });
  },
);

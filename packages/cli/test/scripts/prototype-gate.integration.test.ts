import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getAllScripts } from "../../src/templates/trellis/index.js";

const python = process.platform === "win32" ? "python" : "python3";

function hasPython(): boolean {
  return spawnSync(python, ["--version"]).status === 0;
}

describe.skipIf(!hasPython())("UI prototype start gate", () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-prototype-gate-"));
    for (const [relative, content] of getAllScripts()) {
      const destination = path.join(repo, ".trellis", "scripts", relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, content, "utf8");
    }
    fs.writeFileSync(
      path.join(repo, ".trellis", ".developer"),
      "name=tester\ninitialized_at=2026-08-01T00:00:00\n",
    );
  });

  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  function task(...args: string[]) {
    return spawnSync(python, [".trellis/scripts/task.py", ...args], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, TRELLIS_CONTEXT_ID: "prototype-gate-test" },
    });
  }

  function degradedTask(...args: string[]) {
    const env = { ...process.env };
    for (const name of [
      "TRELLIS_CONTEXT_ID", "PI_SESSION_ID", "CODEX_SESSION_ID", "CODEX_THREAD_ID",
      "CLAUDE_SESSION_ID", "OPENCODE_RUN_ID", "CURSOR_SESSION_ID",
    ]) Reflect.deleteProperty(env, name);
    return spawnSync(python, [".trellis/scripts/task.py", ...args], {
      cwd: repo, encoding: "utf8", env,
    });
  }

  function chineseTask(...args: string[]) {
    return spawnSync(python, [".trellis/scripts/task.py", ...args], {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        TRELLIS_CONTEXT_ID: "prototype-gate-zh-test",
        TRELLIS_LANGUAGE: "zh",
      },
    });
  }

  function createUi(slug = "ui-task"): string {
    const result = task("create", "UI task", "--slug", slug, "--meta", "ui=true", "--no-start");
    expect(result.status).toBe(0);
    const taskDir = result.stdout.trim();
    makeReadyPrd(taskDir);
    expect(setLightweight(taskDir).status).toBe(0);
    return taskDir;
  }

  function profileArgs(): string[] {
    return [
      "--interaction-change", "false",
      "--data-model-change", "false",
      "--public-contract-change", "false",
      "--cross-layer-change", "false",
      "--state-lifecycle-change", "false",
      "--security-compatibility-rollout-change", "false",
      "--technical-tradeoff", "false",
    ];
  }

  function setLightweight(taskDir: string) {
    return task("set-planning-profile", taskDir, ...profileArgs());
  }

  function makeReadyPrd(taskDir: string, chinese = false): void {
    const prdPath = path.join(repo, taskDir, "prd.md");
    let content = fs.readFileSync(prdPath, "utf8");
    if (chinese) {
      content = content
        .replace("- **R1.1 首项改动**：待补充。", "- **R1.1 原型交付**：提供可审阅的用户界面原型。")
        .replace("- [ ] **O1（R1.1）** 待补充。", "- [ ] **O1（R1.1）** 用户可以查看并批准原型。");
    } else {
      content = content
        .replace("- **R1.1 First change**: TBD.", "- **R1.1 Prototype delivery**: provide a reviewable UI prototype.")
        .replace("- [ ] **O1 (R1.1)** TBD.", "- [ ] **O1 (R1.1)** The user can review and approve the prototype.");
    }
    fs.writeFileSync(prdPath, content, "utf8");
  }

  function taskData(taskDir: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(repo, taskDir, "task.json"), "utf8"));
  }

  function manifest(taskDir: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(repo, taskDir, "prototype", "manifest.json"), "utf8"));
  }

  function writeManifest(taskDir: string, value: object): void {
    fs.writeFileSync(path.join(repo, taskDir, "prototype", "manifest.json"), JSON.stringify(value), "utf8");
  }

  function addArtifacts(taskDir: string): void {
    fs.writeFileSync(path.join(repo, taskDir, "prototype", "index.html"), "<main>v1</main>\r\n", "utf8");
    fs.writeFileSync(path.join(repo, taskDir, "prototype", "preview.png"), Buffer.from([1, 2, 3]));
  }

  it("creates an opt-in manifest and approves/start UI task with a current digest", () => {
    const taskDir = createUi();
    expect(taskData(taskDir).meta).toMatchObject({
      planning_contract_version: "2",
      planning_tier: "lightweight",
      ui: "true",
      prototype_manifest: "prototype/manifest.json",
    });
    expect(manifest(taskDir)).toMatchObject({ version: 1, status: "pending_user_approval" });
    const pendingPrd = fs.readFileSync(path.join(repo, taskDir, "prd.md"), "utf8");
    expect(pendingPrd).toContain("[entry](prototype/index.html)");
    expect(pendingPrd).toContain("![prototype preview](prototype/preview.png)");
    expect(pendingPrd).toContain("prototype status: pending_user_approval");
    expect(pendingPrd).toContain("digest: pending");
    addArtifacts(taskDir);
    fs.writeFileSync(path.join(repo, taskDir, "prototype", "preview.png"), Buffer.from([13, 10]));

    const pendingStatus = task("prototype-status", taskDir);
    expect(pendingStatus.status).toBe(0);
    expect(JSON.parse(pendingStatus.stdout)).toMatchObject({
      entry: "prototype/index.html",
      preview: "prototype/preview.png",
      status: "pending_user_approval",
      approval_current: false,
    });
    expect(JSON.parse(pendingStatus.stdout).current_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    const pendingPlanning = task("planning-status", taskDir);
    expect(pendingPlanning.status).toBe(1);
    expect(JSON.parse(pendingPlanning.stdout).checks.ui_prototype).toMatchObject({
      required: true,
      status: "pending_user_approval",
      prd_reference_current: true,
      valid: false,
      errors: ["pending_approval"],
    });

    const approved = task("approve-prototype", taskDir, "user confirmed prototype in review");
    expect(approved.status).toBe(0);
    const approvedManifest = manifest(taskDir);
    expect(approvedManifest.status).toBe("approved");
    expect(approvedManifest.approval_evidence).toBe("user confirmed prototype in review");
    expect(approvedManifest.approved_digest).toBe(approvedManifest.artifact_digest);
    const expectedDigest = createHash("sha256")
      .update("prototype/index.html\0")
      .update("<main>v1</main>\n")
      .update("\0prototype/preview.png\0")
      .update(Buffer.from([13, 10]))
      .update("\0")
      .digest("hex");
    expect(approvedManifest.artifact_digest).toBe(`sha256:${expectedDigest}`);
    const approvedPrd = fs.readFileSync(path.join(repo, taskDir, "prd.md"), "utf8");
    expect(approvedPrd).toContain("prototype status: approved");
    expect(approvedPrd).toContain(`digest: sha256:${expectedDigest}`);
    expect(JSON.parse(task("prototype-status", taskDir).stdout)).toMatchObject({
      current_digest: `sha256:${expectedDigest}`,
      approval_current: true,
      prd_reference_current: true,
    });
    expect(JSON.parse(task("planning-status", taskDir).stdout)).toMatchObject({
      valid: true,
      checks: { ui_prototype: { required: true, valid: true } },
    });

    writeManifest(taskDir, { ...approvedManifest, approval_evidence: "" });
    expect(JSON.parse(task("prototype-status", taskDir).stdout).approval_current).toBe(false);
    const missingEvidence = task("start", taskDir);
    expect(missingEvidence.status).toBe(1);
    expect(missingEvidence.stdout).toContain("approval evidence is required");
    writeManifest(taskDir, approvedManifest);

    const started = task("start", taskDir);
    expect(started.status).toBe(0);
    expect(taskData(taskDir).status).toBe("in_progress");
    expect(fs.existsSync(path.join(repo, ".trellis", ".runtime", "sessions", "prototype-gate-test.json"))).toBe(true);
  });

  it("runs the Chinese create/status/approve/start smoke flow", () => {
    const created = chineseTask(
      "create", "用户界面任务", "--slug", "ui-zh", "--meta", "ui=true", "--no-start",
    );
    expect(created.status).toBe(0);
    const taskDir = created.stdout.trim();
    makeReadyPrd(taskDir, true);
    expect(chineseTask("set-planning-profile", taskDir, ...profileArgs()).status).toBe(0);
    addArtifacts(taskDir);
    expect(JSON.parse(chineseTask("prototype-status", taskDir).stdout)).toMatchObject({
      status: "pending_user_approval",
      approval_current: false,
    });
    expect(chineseTask("approve-prototype", taskDir, "用户已批准最新原型").status).toBe(0);
    expect(chineseTask("start", taskDir).status).toBe(0);
    expect(taskData(taskDir).status).toBe("in_progress");
  });

  it("blocks missing artifacts and pending approval without status, pointer, or hook side effects in degraded mode", () => {
    const taskDir = createUi("pending-task");
    fs.writeFileSync(path.join(repo, ".trellis", "config.yaml"), "hooks:\n  after_start:\n    - echo after-start >> .trellis/hook-events.txt\n");
    const rejected = degradedTask("start", taskDir);
    expect(rejected.status).toBe(1);
    expect(rejected.stdout).toContain("UI prototype gate blocked");
    expect(taskData(taskDir).status).toBe("planning");
    expect(fs.existsSync(path.join(repo, ".trellis", ".runtime"))).toBe(false);
    expect(fs.existsSync(path.join(repo, ".trellis", "hook-events.txt"))).toBe(false);
  });

  it("reports missing entry and preview independently", () => {
    const taskDir = createUi("missing-artifacts");
    fs.writeFileSync(path.join(repo, taskDir, "prototype", "preview.png"), Buffer.from([1]));
    const noEntry = task("approve-prototype", taskDir, "approved");
    expect(noEntry.status).toBe(1);
    expect(noEntry.stdout).toContain("asset file is missing");

    fs.writeFileSync(path.join(repo, taskDir, "prototype", "index.html"), "<main>ok</main>", "utf8");
    fs.rmSync(path.join(repo, taskDir, "prototype", "preview.png"));
    const noPreview = task("approve-prototype", taskDir, "approved");
    expect(noPreview.status).toBe(1);
    expect(noPreview.stdout).toContain("asset file is missing");
  });

  it("rolls back manifest approval when the PRD managed block cannot synchronize", () => {
    const taskDir = createUi("prd-sync-failure");
    addArtifacts(taskDir);
    const prdPath = path.join(repo, taskDir, "prd.md");
    fs.writeFileSync(
      prdPath,
      fs.readFileSync(prdPath, "utf8").replace(
        /<!-- ui-prototype:START -->[\s\S]*?<!-- ui-prototype:END -->/,
        "",
      ),
      "utf8",
    );
    const approved = task("approve-prototype", taskDir, "approved");
    expect(approved.status).toBe(1);
    expect(approved.stdout).toContain("managed UI prototype block is missing");
    expect(manifest(taskDir)).toMatchObject({
      status: "pending_user_approval",
      artifact_digest: null,
      approved_digest: null,
    });
  });

  it("starts a classified lightweight non-UI task in degraded mode", () => {
    const created = degradedTask("create", "plain task", "--slug", "plain", "--no-start");
    expect(created.status).toBe(0);
    const taskDir = created.stdout.trim();
    makeReadyPrd(taskDir);
    expect(setLightweight(taskDir).status).toBe(0);
    const started = degradedTask("start", taskDir);
    expect(started.status).toBe(0);
    expect(taskData(taskDir).status).toBe("in_progress");
    expect(task("prototype-status", taskDir).status).toBe(1);
  });

  it("rejects pending, stale, malformed, and escaping manifests", () => {
    const taskDir = createUi("invalid-manifest");
    addArtifacts(taskDir);
    fs.writeFileSync(path.join(repo, ".trellis", "config.yaml"), "hooks:\n  after_start:\n    - echo after-start >> .trellis/hook-events.txt\n");
    expect(task("start", taskDir).status).toBe(1);
    expect(taskData(taskDir).status).toBe("planning");
    expect(fs.existsSync(path.join(repo, ".trellis", ".runtime", "sessions", "prototype-gate-test.json"))).toBe(false);
    expect(fs.existsSync(path.join(repo, ".trellis", "hook-events.txt"))).toBe(false);
    expect(task("approve-prototype", taskDir, "approved").status).toBe(0);
    fs.writeFileSync(path.join(repo, taskDir, "prototype", "index.html"), "<main>v2</main>\n", "utf8");
    const stale = task("start", taskDir);
    expect(stale.status).toBe(1);
    expect(stale.stdout).toContain("approved digest does not match");
    expect(JSON.parse(task("prototype-status", taskDir).stdout).approval_current).toBe(false);
    expect(taskData(taskDir).status).toBe("planning");
    expect(fs.existsSync(path.join(repo, ".trellis", ".runtime", "sessions", "prototype-gate-test.json"))).toBe(false);
    expect(fs.existsSync(path.join(repo, ".trellis", "hook-events.txt"))).toBe(false);

    writeManifest(taskDir, { version: 2 });
    expect(task("start", taskDir).status).toBe(1);
    expect(task("start", taskDir).stdout).toContain("version 1");

    writeManifest(taskDir, {
      version: 1, entry: "prototype/../task.json", preview: "prototype/preview.png",
      artifact_digest: null, status: "pending_user_approval", approved_digest: null, approval_evidence: null,
    });
    const escaped = task("start", taskDir);
    expect(escaped.status).toBe(1);
    expect(escaped.stdout).toContain("must remain inside prototype/");
  });

  it.skipIf(process.platform === "win32")("rejects a prototype symlink escaping the task", () => {
    const taskDir = createUi("symlink-task");
    fs.writeFileSync(path.join(repo, "external.html"), "outside", "utf8");
    fs.symlinkSync(path.join(repo, "external.html"), path.join(repo, taskDir, "prototype", "index.html"));
    fs.writeFileSync(path.join(repo, taskDir, "prototype", "preview.png"), Buffer.from([1]));
    const rejected = task("approve-prototype", taskDir, "approved");
    expect(rejected.status).toBe(1);
    expect(rejected.stdout).toContain("external symlinks");
  });
});

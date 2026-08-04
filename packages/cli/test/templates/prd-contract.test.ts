import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../..");
const checker = path.join(repoRoot, "packages/cli/scripts/check-prd-contract.mjs");
const temporaryRoots: string[] = [];

function copyContractFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-prd-contract-"));
  temporaryRoots.push(root);
  for (const source of ["packages", ".trellis", "marketplace", "docs-site"]) {
    fs.cpSync(path.join(repoRoot, source), path.join(root, source), {
      recursive: true,
      filter: (name) => !name.includes("node_modules") && !name.includes("dist"),
    });
  }
  return root;
}

function check(root: string): void {
  execFileSync(process.execPath, [checker, "--check"], {
    env: { ...process.env, PRD_CONTRACT_ROOT: root },
    stdio: "pipe",
  });
}

function expectRejected(root: string, relativePath: string, from: string, to: string): void {
  const target = path.join(root, relativePath);
  fs.writeFileSync(target, fs.readFileSync(target, "utf8").replaceAll(from, to), "utf8");
  expect(() => check(root)).toThrow();
}

function expectContractRejected(root: string, mutate: (contract: Record<string, unknown>) => void): void {
  const contractPath = path.join(root, "packages/cli/src/templates/common/prd-contract.json");
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8")) as Record<string, unknown>;
  mutate(contract);
  fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2), "utf8");
  expect(() => check(root)).toThrow();
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("PRD contract checker", () => {
  it("accepts the generated contract blocks", () => {
    expect(() => check(copyContractFixture())).not.toThrow();
  });

  it.each([
    ["section order", "packages/cli/src/templates/trellis/scripts/common/task_store.py", "## Requirements", "## User-visible Outcomes\n\n- TBD\n\n## Requirements"],
    ["legacy acceptance heading", "packages/cli/src/templates/trellis/scripts/common/task_store.py", "## User-visible Outcomes", "## Acceptance Criteria"],
    ["technical boundary", "packages/cli/src/templates/trellis/workflow.md", "technical requirements", "product requirements"],
    ["UI approval gate", "packages/cli/src/templates/trellis/workflow.md", "task.py prototype-status <task>", "task.py prototype-pending <task>"],
    ["numbered requirements", "packages/cli/src/templates/trellis/scripts/common/task_store.py", "### R1 Add", "### Add"],
    ["mapped outcomes", "packages/cli/src/templates/trellis/scripts/common/task_store.py", "**O1 (R1.1)**", "**O1**"],
    ["Mermaid changed class", "packages/cli/src/templates/common/skills/brainstorm.md", "classDef changed", "classDef emphasis"],
    ["Mermaid red link", "packages/cli/src/templates/common/skills/brainstorm.md", "linkStyle 0 stroke:#dc2626", "linkStyle 0 stroke:#000000"],
    ["legacy marketplace PRD definition", "marketplace/workflows/tdd/workflow.md", "Goals are ordered lists", "requirements, constraints, and acceptance criteria"],
  ])("rejects %s drift", (_name, relativePath, from, to) => {
    expectRejected(copyContractFixture(), relativePath, from, to);
  });

  it.each([
    ["UI approval", (contract: Record<string, unknown>) => { contract.uiPrototypeApprovalRequired = false; }],
    ["UI prototype start gate", (contract: Record<string, unknown>) => { contract.uiPrototype = {}; }],
    ["planning profile", (contract: Record<string, unknown>) => { (contract.planningProfile as Record<string, unknown>).allFalseTier = "complex"; }],
    ["requirement numbering", (contract: Record<string, unknown>) => { (contract.requirements as Record<string, unknown>).emptyGroupsAllowed = true; }],
    ["Mermaid red link", (contract: Record<string, unknown>) => { (contract.interactionDiagram as Record<string, unknown>).requiredLinkStyle = "stroke:#000000"; }],
    ["database comments", (contract: Record<string, unknown>) => { (contract.databaseDesign as Record<string, unknown>).fieldCommentsRequired = false; }],
    ["technical boundary", (contract: Record<string, unknown>) => { (contract.technicalDetailTargets as Record<string, string[]>).design = ["product copy"]; }],
  ])("rejects invalid contract %s", (_name, mutate) => {
    expectContractRejected(copyContractFixture(), mutate);
  });

  it.each([
    ["en", "Goal", "Requirements", "User-visible Outcomes"],
    ["zh", "目标", "需求", "用户可见结果"],
  ])("creates a real %s PRD skeleton", (language, goal, requirements, outcomes) => {
    const root = copyContractFixture();
    execFileSync("git", ["init", "-q"], { cwd: root });
    const result = spawnSync(
      process.platform === "win32" ? "python" : "python3",
      [".trellis/scripts/task.py", "create", "PRD probe", "--slug", `prd-${language}`, "--assignee", "probe", "--no-start"],
      { cwd: root, encoding: "utf8", env: { ...process.env, TRELLIS_LANGUAGE: language } },
    );
    expect(result.status, result.stderr).toBe(0);
    const taskDir = fs.readdirSync(path.join(root, ".trellis/tasks")).find((name) => name.endsWith(`prd-${language}`));
    expect(taskDir).toBeDefined();
    if (!taskDir) throw new Error("task.py create did not create the PRD probe task");
    const prd = fs.readFileSync(path.join(root, ".trellis/tasks", taskDir, "prd.md"), "utf8");
    const taskData = JSON.parse(
      fs.readFileSync(path.join(root, ".trellis/tasks", taskDir, "task.json"), "utf8"),
    );
    expect(prd.indexOf(`## ${goal}`)).toBeLessThan(prd.indexOf(`## ${requirements}`));
    expect(prd.indexOf(`## ${requirements}`)).toBeLessThan(prd.indexOf(`## ${outcomes}`));
    expect(prd).toMatch(/\n1\. /);
    expect(prd).toMatch(/\n### R1 /);
    expect(prd).toMatch(/\n- \*\*R1\.1/);
    expect(prd).toMatch(/\n- \[ \] \*\*O1\s*[（(]R1\.1[）)]/);
    expect(prd).toMatch(/\n- \[ \]/);
    expect(taskData.meta).toMatchObject({
      planning_contract_version: "2",
      planning_tier: "pending",
    });
  });
});

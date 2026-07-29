/** Integration coverage for task document profiles and document experiment CLI. */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const scripts = path.resolve(__dirname, "../../src/templates/trellis/scripts");

function hasPython(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hasPython())("task document profiles", () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-document-profile-"));
    fs.cpSync(scripts, path.join(repo, ".trellis", "scripts"), { recursive: true });
    const init = spawnSync("python3", [".trellis/scripts/init_developer.py", "tester"], { cwd: repo, encoding: "utf-8" });
    if (init.status !== 0) throw new Error(init.stderr);
  });

  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  function task(...args: string[]) {
    return spawnSync("python3", [".trellis/scripts/task.py", ...args], { cwd: repo, encoding: "utf-8" });
  }

  function taskDir(slug: string): string {
    const name = fs.readdirSync(path.join(repo, ".trellis", "tasks")).find((item) => item.endsWith(slug));
    if (!name) throw new Error(`Missing task ${slug}`);
    return path.join(repo, ".trellis", "tasks", name);
  }

  it("keeps the native PRD skeleton byte-for-byte and records the profile", () => {
    expect(task("create", "Native", "--slug", "native", "--description", "A goal").status).toBe(0);
    const created = taskDir("native");
    expect(fs.readFileSync(path.join(created, "prd.md"), "utf-8")).toBe(`# Native\n\n## Goal\n\nA goal\n\n## Requirements\n\n- TBD\n\n## Acceptance Criteria\n\n- [ ] TBD\n\n## Notes\n\n- Keep \`prd.md\` focused on requirements, constraints, and acceptance criteria.\n- Lightweight tasks can remain PRD-only.\n- For complex tasks, add \`design.md\` for technical design and \`implement.md\` for execution planning before \`task.py start\`.\n`);
    expect(JSON.parse(fs.readFileSync(path.join(created, "task.json"), "utf-8")).document_profile).toBe("native");
  });

  it("creates a marked reviewable PRD and measures deterministic approval metrics", () => {
    expect(task("create", "可审阅", "--slug", "reviewable", "--document-profile", "reviewable").status).toBe(0);
    const created = taskDir("reviewable");
    const prd = path.join(created, "prd.md");
    expect(fs.readFileSync(prd, "utf-8")).toContain("<!-- trellis:approval-surface:start -->");
    expect(JSON.parse(fs.readFileSync(path.join(created, "task.json"), "utf-8")).document_profile).toBe("reviewable");
    const first = task("document-metrics", prd, "--json");
    const second = task("document-metrics", prd, "--json");
    expect(first.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
    const metrics = JSON.parse(first.stdout);
    expect(metrics.estimator_version).toBe("unicode-v1");
    expect(metrics.approval_surface_estimated_tokens).toBeGreaterThan(0);
    expect(metrics.detail_estimated_tokens).toBeGreaterThan(0);
  });

  it("keeps estimated tokens separate from null runner usage in reports", () => {
    const results = path.join(repo, "results.jsonl");
    const document = { utf8_bytes: 1, characters: 1, lines: 1, estimated_tokens: 1, approval_surface_estimated_tokens: 1, detail_estimated_tokens: 0, headings: 0, checklist_items: 0, unresolved_placeholders: 0, term_definitions: 0 };
    const shadow = { native_path: "native.md", reviewable_path: "reviewable.md", display_variant: "native" };
    const base = { task_id: "fixture", base_sha: "abc", model: null, run: 1, experiment_source: "historical_backtest", assignment: "shadow", document, usage: { input_tokens: null, output_tokens: null, cache_read_tokens: null, cache_write_tokens: null }, interaction: { approval_turns: null, user_correction_tokens: null, wall_clock_ms: null }, guardrails: { critical_requirement_omissions: 0, requirements_coverage: 1, acceptance_passed: true }, shadow };
    fs.writeFileSync(results, `${JSON.stringify({ ...base, variant: "native" })}\n${JSON.stringify({ ...base, variant: "reviewable" })}\n`, "utf-8");
    const report = task("experiment-report", results, "--format", "json");
    expect(report.status).toBe(0);
    const parsed = JSON.parse(report.stdout);
    expect(parsed.variants.native.estimated_document_averages.estimated_tokens).toBe(1);
    expect(parsed.variants.native.actual_runner_usage_averages.input_tokens).toBeNull();
    expect(parsed.native_to_reviewable_delta.estimated_document_averages.estimated_tokens).toBe(0);
  });

  it("rejects experiment records missing model or correctness guardrails", () => {
    const results = path.join(repo, "invalid-results.jsonl");
    fs.writeFileSync(results, JSON.stringify({ task_id: "fixture", variant: "native", base_sha: "abc", run: 1, document: {}, usage: {}, interaction: {}, guardrails: {} }), "utf-8");
    const report = task("experiment-report", results, "--format", "json");
    expect(report.status).toBe(1);
    expect(report.stderr).toContain("model");
  });

  it("rejects empty results and boolean metrics", () => {
    const empty = path.join(repo, "empty-results.jsonl");
    fs.writeFileSync(empty, "\n", "utf-8");
    expect(task("experiment-report", empty, "--format", "json").status).toBe(1);

    const document = { utf8_bytes: true, characters: 1, lines: 1, estimated_tokens: 1, approval_surface_estimated_tokens: 1, detail_estimated_tokens: 0, headings: 0, checklist_items: 0, unresolved_placeholders: 0, term_definitions: 0 };
    const invalid = path.join(repo, "boolean-metric.jsonl");
    fs.writeFileSync(invalid, JSON.stringify({ task_id: "fixture", variant: "native", base_sha: "abc", model: null, run: 1, experiment_source: "real_task", assignment: "randomized", document, usage: { input_tokens: null, output_tokens: null, cache_read_tokens: null, cache_write_tokens: null }, interaction: { approval_turns: null, user_correction_tokens: null, wall_clock_ms: null }, guardrails: { critical_requirement_omissions: 0, requirements_coverage: 1, acceptance_passed: true } }), "utf-8");
    expect(task("experiment-report", invalid, "--format", "json").status).toBe(1);
  });
});

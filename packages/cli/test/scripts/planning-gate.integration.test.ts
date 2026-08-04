import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getAllScripts } from "../../src/templates/trellis/index.js";

const python = process.platform === "win32" ? "python" : "python3";

interface TaskData {
  status: string;
  meta: Record<string, string>;
  [key: string]: unknown;
}

function hasPython(): boolean {
  return spawnSync(python, ["--version"]).status === 0;
}

describe.skipIf(!hasPython())("planning contract start gate", () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-planning-gate-"));
    for (const [relative, content] of getAllScripts()) {
      const destination = path.join(repo, ".trellis", "scripts", relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, content, "utf8");
    }
    fs.writeFileSync(
      path.join(repo, ".trellis", ".developer"),
      "name=tester\ninitialized_at=2026-08-04T00:00:00\n",
    );
  });

  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  function task(...args: string[]) {
    return spawnSync(python, [".trellis/scripts/task.py", ...args], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, TRELLIS_CONTEXT_ID: "planning-gate-test" },
    });
  }

  function create(slug: string): string {
    const result = task("create", "Planning probe", "--slug", slug, "--no-start");
    expect(result.status).toBe(0);
    return result.stdout.trim();
  }

  function taskData(taskDir: string): TaskData {
    return JSON.parse(
      fs.readFileSync(path.join(repo, taskDir, "task.json"), "utf8"),
    ) as TaskData;
  }

  function writeReadyPrd(taskDir: string): void {
    fs.writeFileSync(
      path.join(repo, taskDir, "prd.md"),
      `# Planning probe

## Goal

1. Deliver one understandable change.

## Requirements

### R1 Add

- **R1.1 Visible behavior**: expose the requested behavior.

### R2 Preserve

- **R2.1 Compatibility**: preserve historical task behavior.

## User-visible Outcomes

- [ ] **O1 (R1.1, R2.1)** The requested behavior is visible and compatible.
`,
      "utf8",
    );
  }

  function profile(taskDir: string, overrides: Record<string, string> = {}) {
    const values = {
      interaction_change: "false",
      data_model_change: "false",
      public_contract_change: "false",
      cross_layer_change: "false",
      state_lifecycle_change: "false",
      security_compatibility_rollout_change: "false",
      technical_tradeoff: "false",
      ...overrides,
    };
    return task(
      "set-planning-profile",
      taskDir,
      ...Object.entries(values).flatMap(([key, value]) => [`--${key.replaceAll("_", "-")}`, value]),
    );
  }

  it("seeds an unresolved v2 profile and blocks start without side effects", () => {
    const taskDir = create("pending");
    const data = taskData(taskDir);
    expect(data.meta).toMatchObject({
      planning_contract_version: "2",
      planning_tier: "pending",
      ui: "false",
      interaction_change: "unknown",
    });
    expect(fs.readFileSync(path.join(repo, taskDir, "prd.md"), "utf8")).toContain("### R1 Add");
    const status = task("planning-status", taskDir);
    expect(status.status).toBe(1);
    expect(JSON.parse(status.stdout)).toMatchObject({
      legacy: false,
      planning_tier: "pending",
      valid: false,
    });
    const started = task("start", taskDir);
    expect(started.status).toBe(1);
    expect(started.stdout).toContain("answer all seven planning profile questions");
    expect(taskData(taskDir).status).toBe("planning");
    expect(fs.existsSync(path.join(repo, ".trellis", ".runtime"))).toBe(false);
  });

  it("derives lightweight from seven false answers and permits PRD-only start", () => {
    const taskDir = create("lightweight");
    writeReadyPrd(taskDir);
    expect(profile(taskDir).status).toBe(0);
    expect(taskData(taskDir).meta.planning_tier).toBe("lightweight");
    const status = task("planning-status", taskDir);
    expect(status.status, status.stdout + status.stderr).toBe(0);
    const started = task("start", taskDir);
    expect(started.status, started.stdout + started.stderr).toBe(0);
    expect(taskData(taskDir).status).toBe("in_progress");
  });

  it("derives complex from any true answer and requires design plus implement", () => {
    const taskDir = create("complex");
    writeReadyPrd(taskDir);
    expect(profile(taskDir, { public_contract_change: "true" }).status).toBe(0);
    const blocked = task("start", taskDir);
    expect(blocked.status).toBe(1);
    expect(blocked.stdout).toContain("complex planning requires design.md");
    expect(blocked.stdout).toContain("complex planning requires implement.md");
    fs.writeFileSync(path.join(repo, taskDir, "design.md"), "# Design\n", "utf8");
    fs.writeFileSync(path.join(repo, taskDir, "implement.md"), "# Implementation\n", "utf8");
    const started = task("start", taskDir);
    expect(started.status, started.stdout + started.stderr).toBe(0);
  });

  it("requires an explicitly labeled and red-highlighted interaction change flow", () => {
    const taskDir = create("interaction");
    writeReadyPrd(taskDir);
    expect(profile(taskDir, { interaction_change: "true" }).status).toBe(0);
    fs.writeFileSync(path.join(repo, taskDir, "design.md"), "# Design\n", "utf8");
    fs.writeFileSync(path.join(repo, taskDir, "implement.md"), "# Implementation\n", "utf8");
    expect(task("start", taskDir).stdout).toContain("interaction changes require a Mermaid section");
    fs.appendFileSync(
      path.join(repo, taskDir, "prd.md"),
      `
### Interaction Changes

\`\`\`mermaid
flowchart LR
  A["Existing entry"] --> B["Change: confirmation step"]
  classDef changed fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;
  class B changed;
  linkStyle 0 stroke:#dc2626,stroke-width:3px;
\`\`\`
`,
      "utf8",
    );
    const started = task("start", taskDir);
    expect(started.status, started.stdout + started.stderr).toBe(0);
  });

  it("accepts native table/field comments and requires a complete data dictionary", () => {
    const taskDir = create("data-model");
    writeReadyPrd(taskDir);
    expect(profile(taskDir, { data_model_change: "true" }).status).toBe(0);
    fs.writeFileSync(path.join(repo, taskDir, "implement.md"), "# Implementation\n", "utf8");
    fs.writeFileSync(
      path.join(repo, taskDir, "design.md"),
      `# Design

## Data Model

Stores reviewable task decisions.

### DDL

\`\`\`mysql
CREATE TABLE task_decision (
  id BIGINT NOT NULL COMMENT 'Decision identifier',
  summary VARCHAR(255) NOT NULL COMMENT 'Decision summary',
  PRIMARY KEY (id)
) COMMENT='Task planning decisions';
\`\`\`

### Table and Field Descriptions

The \`task_decision\` table stores approved planning decisions.

| Field | Type | Null | Default | Description | Constraint |
| --- | --- | --- | --- | --- | --- |
| id | BIGINT | no | none | decision identifier | Primary Key |
| summary | VARCHAR(255) | no | none | decision summary | required |

### Migration and Rollback

Migration creates the table after a backup. Rollback drops it after verification.
`,
      "utf8",
    );
    const status = task("planning-status", taskDir);
    expect(status.status, status.stdout + status.stderr).toBe(0);
    const started = task("start", taskDir);
    expect(started.status, started.stdout + started.stderr).toBe(0);
  });

  it("accepts PostgreSQL COMMENT ON and SQLite SQL comments with a data dictionary", () => {
    const cases = [
      {
        slug: "postgres-comments",
        design: `# Design

## Data Model

Stores audit events.

### DDL

\`\`\`postgresql
CREATE TABLE audit_event (
  id BIGINT NOT NULL,
  detail TEXT NOT NULL,
  PRIMARY KEY (id)
);
COMMENT ON TABLE audit_event IS 'Audit events';
COMMENT ON COLUMN audit_event.id IS 'Event identifier';
COMMENT ON COLUMN audit_event.detail IS 'Event detail';
\`\`\`

### Table and Field Descriptions

The \`audit_event\` table stores audit events.

| Field | Type | Description |
| --- | --- | --- |
| id | BIGINT | event identifier; Primary Key |
| detail | TEXT | event detail |

### Migration and Rollback

Migration creates the table. Rollback drops it.
`,
      },
      {
        slug: "sqlite-comments",
        design: `# Design

## Data Model

Stores local cache entries.

### DDL

\`\`\`sqlite
-- cache_entry table: local cache entries
CREATE TABLE cache_entry (
  -- id: cache entry identifier
  id INTEGER NOT NULL,
  -- value: cached text
  value TEXT NOT NULL,
  PRIMARY KEY (id)
);
\`\`\`

### Table and Field Descriptions

The \`cache_entry\` table stores local cache entries.

| Field | Type | Description |
| --- | --- | --- |
| id | INTEGER | cache entry identifier; Primary Key |
| value | TEXT | cached text |

### Migration and Rollback

Migration creates the table. Rollback drops it.
`,
      },
    ];
    for (const value of cases) {
      const taskDir = create(value.slug);
      writeReadyPrd(taskDir);
      expect(profile(taskDir, { data_model_change: "true" }).status).toBe(0);
      fs.writeFileSync(path.join(repo, taskDir, "implement.md"), "# Implementation\n", "utf8");
      fs.writeFileSync(path.join(repo, taskDir, "design.md"), value.design, "utf8");
      const status = task("planning-status", taskDir);
      expect(status.status, status.stdout + status.stderr).toBe(0);
    }
  });

  it("checks comments for ALTER TABLE fields and rejects undocumented DDL", () => {
    const taskDir = create("alter-comments");
    writeReadyPrd(taskDir);
    expect(profile(taskDir, { data_model_change: "true" }).status).toBe(0);
    fs.writeFileSync(path.join(repo, taskDir, "implement.md"), "# Implementation\n", "utf8");
    const designPath = path.join(repo, taskDir, "design.md");
    fs.writeFileSync(
      designPath,
      `# Design

## Data Model

Extends user profiles.

### DDL

\`\`\`postgresql
ALTER TABLE user_profile ADD COLUMN nickname TEXT;
\`\`\`

### Table and Field Descriptions

| Field | Type | Description |
| --- | --- | --- |
| nickname | TEXT | public nickname |

### Migration and Rollback

Migration adds the field and preserves the Primary Key. Rollback drops it.
`,
      "utf8",
    );
    const rejected = JSON.parse(task("planning-status", taskDir).stdout);
    expect(rejected.errors).toEqual(
      expect.arrayContaining(["table_comment_missing", "field_comment_missing"]),
    );
    fs.writeFileSync(
      designPath,
      `# Design

## Data Model

Extends user profiles.

### DDL

\`\`\`postgresql
ALTER TABLE user_profile ADD COLUMN nickname TEXT;
COMMENT ON TABLE user_profile IS 'User profile data';
COMMENT ON COLUMN user_profile.nickname IS 'Public nickname';
\`\`\`

### Table and Field Descriptions

The \`user_profile\` table stores user profile data.

| Field | Type | Description |
| --- | --- | --- |
| nickname | TEXT | public nickname |

### Migration and Rollback

Migration adds the field and preserves the Primary Key. Rollback drops it.
`,
      "utf8",
    );
    const accepted = task("planning-status", taskDir);
    expect(accepted.status, accepted.stdout + accepted.stderr).toBe(0);
  });

  it("keeps tasks without a contract version on the legacy path", () => {
    const taskDir = create("legacy");
    const data = taskData(taskDir);
    data.meta = { custom: "kept" };
    fs.writeFileSync(path.join(repo, taskDir, "task.json"), JSON.stringify(data), "utf8");
    fs.writeFileSync(path.join(repo, taskDir, "prd.md"), "# Legacy\n\nNo v2 structure.\n", "utf8");
    expect(JSON.parse(task("planning-status", taskDir).stdout)).toMatchObject({
      legacy: true,
      valid: true,
    });
    expect(task("start", taskDir).status).toBe(0);
  });
});

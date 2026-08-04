#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = process.env.PRD_CONTRACT_ROOT
  ? path.resolve(process.env.PRD_CONTRACT_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const contract = JSON.parse(fs.readFileSync(path.join(root, "packages/cli/src/templates/common/prd-contract.json"), "utf8"));
const checkOnly = process.argv.includes("--check");
const start = "<!-- prd-contract:START -->";
const end = "<!-- prd-contract:END -->";
const failures = [];

function validateContract() {
  const requiredTargets = {
    design: ["technical requirements", "algorithms", "data contracts", "compatibility", "rollout", "rollback"],
    implement: ["ordered checklist", "commands", "test execution"],
    research: ["source diagnosis", "file:line evidence", "investigation facts"],
  };
  const triggers = ["interaction_change", "data_model_change", "public_contract_change", "cross_layer_change", "state_lifecycle_change", "security_compatibility_rollout_change", "technical_tradeoff"];
  if (contract.version !== 2 || contract.goalListStyle !== "ordered" || contract.outcomeListStyle !== "checklist") failures.push("prd-contract.json: invalid v2 list-style contract");
  if (JSON.stringify(contract.fixedOrder) !== JSON.stringify(["goal", "requirements", "userVisibleOutcomes"])) failures.push("prd-contract.json: fixedOrder must contain the three canonical sections");
  if (contract.uiPrototypeApprovalRequired !== true) failures.push("prd-contract.json: UI prototype approval must be required");
  const ui = contract.uiPrototype;
  if (ui?.directory !== "prototype/" || ui?.manifest !== "prototype/manifest.json" || JSON.stringify(ui?.statuses) !== JSON.stringify(["pending_user_approval", "approved"]) || ui?.approvalBoundToDigest !== true || ui?.startGateRequired !== true || JSON.stringify(ui?.prdManagedBlock) !== JSON.stringify(["entry", "preview", "status", "digest"]) || ui?.prdSection !== "userVisibleOutcomes") failures.push("prd-contract.json: UI prototype directory, PRD block, and start-gate contract are invalid");
  if (JSON.stringify(contract.requirements?.changeTypes?.en) !== JSON.stringify(["Add", "Change", "Remove", "Preserve", "Boundary"]) || JSON.stringify(contract.requirements?.changeTypes?.zh) !== JSON.stringify(["新增", "修改", "删除", "保持不变", "边界"]) || contract.requirements?.emptyGroupsAllowed !== false) failures.push("prd-contract.json: numbered requirement change types are invalid");
  if (contract.outcomes?.requirementMappingRequired !== true) failures.push("prd-contract.json: outcome-to-requirement mapping must be required");
  const profile = contract.planningProfile;
  if (profile?.versionField !== "planning_contract_version" || profile?.version !== "2" || profile?.tierField !== "planning_tier" || JSON.stringify(profile?.complexityTriggers) !== JSON.stringify(triggers) || profile?.allFalseTier !== "lightweight" || profile?.anyTrueTier !== "complex" || profile?.unknownTier !== "pending" || profile?.legacyTasksBlocked !== false) failures.push("prd-contract.json: planning profile derivation contract is invalid");
  if (JSON.stringify(contract.technicalDetailTargets) !== JSON.stringify(requiredTargets)) failures.push("prd-contract.json: technicalDetailTargets must preserve the canonical artifact boundary");
  const interaction = contract.interactionDiagram;
  if (interaction?.requiredWhen !== "interaction_change=true" || interaction?.requiredClass !== "changed" || interaction?.requiredLinkStyle !== "stroke:#dc2626" || interaction?.prdSection !== "userVisibleOutcomes") failures.push("prd-contract.json: conditional interaction-diagram requirements are invalid");
  const database = contract.databaseDesign;
  if (database?.requiredWhen !== "data_model_change=true" || database?.artifact !== "design.md" || database?.tableCommentsRequired !== true || database?.fieldCommentsRequired !== true || database?.erDiagramRequired !== false) failures.push("prd-contract.json: database design comment/ER contract is invalid");
  for (const locale of ["en", "zh"]) for (const key of contract.fixedOrder) if (!contract.locales?.[locale]?.[key]) failures.push(`prd-contract.json: ${locale}.${key} is required`);
}

function managedBlock(kind, locale) {
  const { goal, requirements, userVisibleOutcomes } = contract.locales[locale];
  const targets = contract.technicalDetailTargets;
  const interaction = contract.interactionDiagram;
  const chinese = locale === "zh";
  const title = chinese ? "PRD 合同" : "PRD Contract";
  const boundary = chinese
    ? "技术设计进入 `design.md`；有序执行进入 `implement.md`；源码诊断进入 `research/`。"
    : `Technical design (${targets.design.join(", ")}) belongs in \`design.md\`; ordered execution (${targets.implement.join(", ")}) belongs in \`implement.md\`; source diagnosis (${targets.research.join(", ")}) belongs in \`research/\`.`;
  const summary = chinese
    ? `最终 \`prd.md\` 的固定章节依次为 ${goal}（\`Goal\`）、${requirements}（\`Requirements\`）和 ${userVisibleOutcomes}（\`User-visible Outcomes\`）。目标使用有序列表；需求按实际变更类型使用 \`R1/R1.1\` 编号；用户可见结果使用 \`O1\` 检查清单并映射需求编号。${boundary}`
    : `Final \`prd.md\` sections are \`${goal}\`, \`${requirements}\`, and \`${userVisibleOutcomes}\` in that order. Goals are ordered lists; Requirements use actual change-type groups with \`R1/R1.1\` IDs; User-visible Outcomes use \`O1\` checklists mapped to requirement IDs. ${boundary}`;
  const profile = chinese
    ? "使用 `task.py set-planning-profile <task> ...` 一次回答七项画像：全部为 `false` 推导为 `lightweight`，任一为 `true` 推导为 `complex`，未决则为 `pending` 并禁止 `start`。复杂 Task 必须有 `design.md` 和 `implement.md`。"
    : "Use `task.py set-planning-profile <task> ...` to answer all seven profile questions at once: all `false` derives `lightweight`, any `true` derives `complex`, and unresolved answers derive `pending` and block `start`. Complex tasks require `design.md` and `implement.md`.";
  const ui = chinese
    ? "用户界面工作使用 `--meta ui=true` 和标准 `prototype/manifest.json`；PRD 的“用户可见结果”必须展示原型入口、预览、状态和摘要。使用 `task.py prototype-status <task>` 查看当前状态，用户查看最新原型后运行 `task.py approve-prototype <task> <approval-evidence>` 记录批准并同步 PRD；`task.py start` 执行硬门禁。"
    : "UI work uses `--meta ui=true` and the standard `prototype/manifest.json`; User-visible Outcomes must show the prototype entry, preview, status, and digest. Inspect current state with `task.py prototype-status <task>`, then record approval and synchronize the PRD with `task.py approve-prototype <task> <approval-evidence>`; `task.py start` is a hard gate.";
  const diagramRule = chinese
    ? `流程图通常可选；仅当 \`interaction_change=true\` 时必须放在“用户可见结果”中，并用“新增/修改/删除”文字、\`classDef ${interaction.requiredClass}\` 和红色 \`linkStyle\`（\`${interaction.requiredLinkStyle}\`）突出变化流程。`
    : `Diagrams are normally optional. When \`interaction_change=true\`, put one in User-visible Outcomes and identify the changed flow with Add/Change/Remove text, \`classDef ${interaction.requiredClass}\`, and red \`linkStyle\` (\`${interaction.requiredLinkStyle}\`).`;
  const database = chinese
    ? "当 `data_model_change=true` 时，`design.md` 必须包含数据模型、正式 `DDL`、表与全部字段备注、约束、迁移和回滚；`ER` 图可选。"
    : "When `data_model_change=true`, `design.md` must include the data model, executable `DDL`, table and every-field comments, constraints, migration, and rollback; an `ER` diagram is optional.";
  const diagram = `\`\`\`mermaid\nflowchart LR\n  A["${chinese ? "原有入口" : "Existing entry"}"] --> B["${chinese ? "修改：确认步骤" : "Change: confirmation step"}"] --> C["${chinese ? "原有结果" : "Existing result"}"]\n  classDef ${interaction.requiredClass} fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-width:2px;\n  class B ${interaction.requiredClass};\n  linkStyle 0 ${interaction.requiredLinkStyle},stroke-width:3px;\n\`\`\``;
  return `${start}\n## ${title}\n\n${summary}\n\n${profile}\n\n${ui}\n\n${diagramRule}\n\n${database}${kind === "brainstorm" ? `\n\n${diagram}` : ""}\n${end}\n`;
}

const targets = [
  ["packages/cli/src/templates/trellis/workflow.md", "workflow", "en"],
  [".trellis/workflow.md", "workflow", "en"],
  ["packages/cli/src/templates/trellis/workflow.zh.md", "workflow", "zh"],
  ["marketplace/workflows/native/workflow.md", "workflow", "en"],
  ["marketplace/workflows/tdd/workflow.md", "workflow", "en"],
  ["marketplace/workflows/channel-driven-subagent-dispatch/workflow.md", "workflow", "en"],
  ["packages/cli/src/templates/common/skills/brainstorm.md", "brainstorm", "en"],
  ["packages/cli/src/templates/common/skills/brainstorm.zh.md", "brainstorm", "zh"],
];
const legacyScanTargets = [
  ...targets.map(([relativePath]) => relativePath),
  "packages/cli/src/templates/copilot/prompts/parallel.prompt.md",
  "packages/cli/src/templates/common/skills/before-dev.md",
  "packages/cli/src/templates/common/skills/before-dev.zh.md",
  "packages/cli/src/templates/common/bundled-skills/trellis-meta/references/local-architecture/task-system.md",
  "packages/cli/src/templates/common/bundled-skills/trellis-meta/references/local-architecture/task-system.zh.md",
  ".trellis/spec/cli/backend/platform-integration.md",
  "docs-site/guides/tasks.mdx", "docs-site/zh/guides/tasks.mdx",
  "docs-site/start/how-it-works.mdx", "docs-site/zh/start/how-it-works.mdx",
  "docs-site/start/everyday-use.mdx", "docs-site/zh/start/everyday-use.mdx",
  "docs-site/advanced/architecture.mdx", "docs-site/zh/advanced/architecture.mdx",
  "docs-site/start/real-world-scenarios.mdx", "docs-site/zh/start/real-world-scenarios.mdx",
];

function syncTarget(relativePath, kind, locale) {
  const file = path.join(root, relativePath);
  const desired = managedBlock(kind, locale);
  const content = fs.readFileSync(file, "utf8");
  const pattern = new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`);
  if (pattern.test(content)) {
    if (content.match(pattern)?.[0] !== desired) {
      if (checkOnly) failures.push(`${relativePath}: managed PRD contract block drifted`);
      else fs.writeFileSync(file, content.replace(pattern, desired), "utf8");
    }
  } else if (checkOnly) failures.push(`${relativePath}: missing managed PRD contract block`);
  else fs.writeFileSync(file, `${content.trimEnd()}\n\n${desired}`, "utf8");
}

function validateRenderer(relativePath) {
  const content = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const headings of [["## Goal", "## Requirements", "## User-visible Outcomes"], ["## 目标", "## 需求", "## 用户可见结果"]]) {
    const indexes = headings.map((heading) => content.indexOf(heading));
    if (indexes.some((index) => index < 0) || !(indexes[0] < indexes[1] && indexes[1] < indexes[2])) failures.push(`${relativePath}: fixed PRD headings are missing or out of order`);
    const goalBody = content.slice(indexes[0] + headings[0].length, indexes[1]);
    const outcomeBody = content.slice(indexes[2] + headings[2].length, content.indexOf('"""', indexes[2]));
    if (!/^\s*1\.\s/m.test(goalBody)) failures.push(`${relativePath}: Goal must use an ordered list`);
    if (!/^\s*- \[ \]\s/m.test(outcomeBody)) failures.push(`${relativePath}: User-visible Outcomes must use a checklist`);
  }
  if (!/^\s*### R1 Add\s/m.test(content) || !/^\s*### R1 新增\s/m.test(content) || (content.match(/^\s*- \*\*R1\.1/gm) ?? []).length < 2) failures.push(`${relativePath}: both default locales must use R1/R1.1 numbering`);
  if (!/^\s*- \[ \] \*\*O1 \(R1\.1\)/m.test(content) || !/^\s*- \[ \] \*\*O1（R1\.1）/m.test(content)) failures.push(`${relativePath}: both default locales must use O1 and map R1.1`);
  if (content.includes("## Acceptance Criteria") || content.includes("## 验收标准")) failures.push(`${relativePath}: legacy acceptance section is still a fixed PRD heading`);
}

function validateNoLegacyPrdDefinition(relativePath) {
  const content = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const legacy of ["requirements, constraints, and acceptance criteria", "需求、约束、验收标准", "## Acceptance Criteria", "## 验收标准"]) {
    if (content.includes(legacy)) failures.push(`${relativePath}: legacy PRD definition remains (${legacy})`);
  }
}

function validateRealGeneration(language) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-prd-contract-"));
  try {
    fs.mkdirSync(path.join(tmp, ".trellis"), { recursive: true });
    fs.cpSync(path.join(root, ".trellis/scripts"), path.join(tmp, ".trellis/scripts"), { recursive: true });
    const init = spawnSync("git", ["init", "-q"], { cwd: tmp, encoding: "utf8" });
    if (init.status !== 0) throw new Error(init.stderr || "git init failed");
    const create = spawnSync(process.platform === "win32" ? "python" : "python3", [".trellis/scripts/task.py", "create", "PRD contract probe", "--slug", `prd-contract-${language}`, "--assignee", "contract-check", "--no-start"], { cwd: tmp, encoding: "utf8", env: { ...process.env, TRELLIS_LANGUAGE: language } });
    if (create.status !== 0) throw new Error(create.stderr || create.stdout || "task.py create failed");
    const task = fs.readdirSync(path.join(tmp, ".trellis/tasks")).find((entry) => entry.endsWith(`prd-contract-${language}`));
    if (!task) throw new Error("task.py create did not create a PRD");
    const taskRoot = path.join(tmp, ".trellis/tasks", task);
    const prd = fs.readFileSync(path.join(taskRoot, "prd.md"), "utf8");
    const taskData = JSON.parse(fs.readFileSync(path.join(taskRoot, "task.json"), "utf8"));
    const headings = language === "zh" ? ["## 目标", "## 需求", "## 用户可见结果"] : ["## Goal", "## Requirements", "## User-visible Outcomes"];
    const indexes = headings.map((heading) => prd.indexOf(heading));
    if (indexes.some((index) => index < 0) || !(indexes[0] < indexes[1] && indexes[1] < indexes[2]) || !/^1\. /m.test(prd.slice(indexes[0], indexes[1])) || !/^### R1 /m.test(prd) || !/^- \*\*R1\.1/m.test(prd) || !/^- \[ \] \*\*O1\s*[（(]R1\.1[）)]/m.test(prd) || taskData.meta?.planning_contract_version !== "2" || taskData.meta?.planning_tier !== "pending") throw new Error("generated PRD/task metadata does not satisfy contract v2");
  } catch (error) {
    failures.push(`real ${language} task.py create: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

validateContract();
validateRenderer("packages/cli/src/templates/trellis/scripts/common/task_store.py");
validateRenderer(".trellis/scripts/common/task_store.py");
for (const [relativePath, kind, locale] of targets) syncTarget(relativePath, kind, locale);
for (const relativePath of legacyScanTargets) validateNoLegacyPrdDefinition(relativePath);
if (checkOnly) for (const language of ["en", "zh"]) validateRealGeneration(language);
if (failures.length) {
  console.error("PRD contract check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log(checkOnly ? "PRD contract check passed." : "PRD contract blocks synchronized.");

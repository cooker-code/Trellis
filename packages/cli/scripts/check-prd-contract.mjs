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
  if (contract.version !== 1 || contract.goalListStyle !== "ordered" || contract.outcomeListStyle !== "checklist") failures.push("prd-contract.json: invalid list-style contract");
  if (JSON.stringify(contract.fixedOrder) !== JSON.stringify(["goal", "requirements", "userVisibleOutcomes"])) failures.push("prd-contract.json: fixedOrder must contain the three canonical sections");
  if (contract.uiPrototypeApprovalRequired !== true) failures.push("prd-contract.json: UI prototype approval must be required");
  if (JSON.stringify(contract.technicalDetailTargets) !== JSON.stringify(requiredTargets)) failures.push("prd-contract.json: technicalDetailTargets must preserve the canonical artifact boundary");
  if (contract.mermaidCriticalPath?.requiredClass !== "critical" || contract.mermaidCriticalPath?.requiredLinkStyle !== "stroke:#dc2626" || contract.mermaidCriticalPath?.textLabelRequired !== true) failures.push("prd-contract.json: Mermaid critical-path requirements are invalid");
  for (const locale of ["en", "zh"]) for (const key of contract.fixedOrder) if (!contract.locales?.[locale]?.[key]) failures.push(`prd-contract.json: ${locale}.${key} is required`);
}

function managedBlock(kind, locale) {
  const { goal, requirements, userVisibleOutcomes } = contract.locales[locale];
  const targets = contract.technicalDetailTargets;
  const mermaid = contract.mermaidCriticalPath;
  const chinese = locale === "zh";
  const title = chinese ? "PRD 合同" : "PRD Contract";
  const boundary = chinese
    ? "技术设计进入 `design.md`；有序执行进入 `implement.md`；源码诊断进入 `research/`。"
    : `Technical design (${targets.design.join(", ")}) belongs in \`design.md\`; ordered execution (${targets.implement.join(", ")}) belongs in \`implement.md\`; source diagnosis (${targets.research.join(", ")}) belongs in \`research/\`.`;
  const ui = chinese
    ? "用户界面工作必须在用户可见结果中包含原型，并在用户明确确认前报告 `prototype status: pending_user_approval`；待确认时不得运行 `task.py start`。"
    : "For UI work, include the prototype in User-visible Outcomes and report `prototype status: pending_user_approval` until the user explicitly approves it; do not run `task.py start` while pending.";
  const mermaidRule = chinese
    ? `关键路径必须有明确标签、\`classDef ${mermaid.requiredClass}\`、\`class ... ${mermaid.requiredClass}\` 和红色 \`linkStyle\`（\`${mermaid.requiredLinkStyle}\`）；不能只依赖颜色。`
    : `A critical path needs explicit labels, \`classDef ${mermaid.requiredClass}\`, \`class ... ${mermaid.requiredClass}\`, and red \`linkStyle\` (\`${mermaid.requiredLinkStyle}\`); never rely on colour alone.`;
  const summary = chinese
    ? `最终 \`prd.md\` 的固定章节依次为 ${goal}（\`Goal\`）、${requirements}（\`Requirements\`）和 ${userVisibleOutcomes}（\`User-visible Outcomes\`）。目标使用有序列表，用户可见结果使用检查清单。${boundary}`
    : `Final \`prd.md\` sections are \`${goal}\`, \`${requirements}\`, and \`${userVisibleOutcomes}\` in that order. Goals are ordered lists and user-visible outcomes are checklists. ${boundary}`;
  const diagram = `\`\`\`mermaid\nflowchart LR\n  A[\"${chinese ? "关键入口" : "Critical entry"}\"] --> B[\"${chinese ? "关键处理" : "Critical processing"}\"] --> C[\"${chinese ? "关键结果" : "Critical result"}\"]\n  classDef ${mermaid.requiredClass} fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-width:2px;\n  class A,B,C ${mermaid.requiredClass};\n  linkStyle 0,1 ${mermaid.requiredLinkStyle},stroke-width:3px;\n\`\`\``;
  return `${start}\n## ${title}\n\n${summary}\n\n${ui}\n\n${chinese ? "仅当流程图确实提升理解时才使用。" : "Use Mermaid only when it improves understanding."} ${mermaidRule}${kind === "brainstorm" ? `\n\n${diagram}` : ""}\n${end}\n`;
}

const targets = [["packages/cli/src/templates/trellis/workflow.md", "workflow", "en"], [".trellis/workflow.md", "workflow", "en"], ["packages/cli/src/templates/trellis/workflow.zh.md", "workflow", "zh"], ["marketplace/workflows/native/workflow.md", "workflow", "en"], ["marketplace/workflows/tdd/workflow.md", "workflow", "en"], ["marketplace/workflows/channel-driven-subagent-dispatch/workflow.md", "workflow", "en"], ["packages/cli/src/templates/common/skills/brainstorm.md", "brainstorm", "en"], ["packages/cli/src/templates/common/skills/brainstorm.zh.md", "brainstorm", "zh"]];
const legacyScanTargets = [
  ...targets.map(([relativePath]) => relativePath),
  "packages/cli/src/templates/copilot/prompts/parallel.prompt.md",
  "packages/cli/src/templates/common/skills/before-dev.md",
  "packages/cli/src/templates/common/skills/before-dev.zh.md",
  "packages/cli/src/templates/common/bundled-skills/trellis-meta/references/local-architecture/task-system.md",
  "packages/cli/src/templates/common/bundled-skills/trellis-meta/references/local-architecture/task-system.zh.md",
  ".trellis/spec/cli/backend/platform-integration.md",
  "docs-site/guides/tasks.mdx",
  "docs-site/zh/guides/tasks.mdx",
  "docs-site/start/how-it-works.mdx",
  "docs-site/zh/start/how-it-works.mdx",
  "docs-site/start/everyday-use.mdx",
  "docs-site/zh/start/everyday-use.mdx",
  "docs-site/advanced/architecture.mdx",
  "docs-site/zh/advanced/architecture.mdx",
  "docs-site/start/real-world-scenarios.mdx",
  "docs-site/zh/start/real-world-scenarios.mdx",
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
  if (content.includes("## Acceptance Criteria") || content.includes("## 验收标准")) failures.push(`${relativePath}: legacy acceptance section is still a fixed PRD heading`);
}

function validateNoLegacyPrdDefinition(relativePath) {
  const content = fs.readFileSync(path.join(root, relativePath), "utf8");
  const legacyDefinitions = [
    "requirements, constraints, and acceptance criteria",
    "需求、约束、验收标准",
    "## Acceptance Criteria",
    "## 验收标准",
  ];
  for (const legacy of legacyDefinitions) {
    if (content.includes(legacy)) {
      failures.push(`${relativePath}: legacy PRD definition remains (${legacy})`);
    }
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
    const prd = fs.readFileSync(path.join(tmp, ".trellis/tasks", task, "prd.md"), "utf8");
    const headings = language === "zh" ? ["## 目标", "## 需求", "## 用户可见结果"] : ["## Goal", "## Requirements", "## User-visible Outcomes"];
    const indexes = headings.map((heading) => prd.indexOf(heading));
    if (indexes.some((index) => index < 0) || !(indexes[0] < indexes[1] && indexes[1] < indexes[2]) || !/^1\. /m.test(prd.slice(indexes[0], indexes[1])) || !/^- \[ \]/m.test(prd.slice(indexes[2]))) throw new Error("generated PRD does not satisfy the contract");
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
if (failures.length) { console.error("PRD contract check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n")); process.exit(1); }
console.log(checkOnly ? "PRD contract check passed." : "PRD contract blocks synchronized.");

# 当前状态与证据

## 结论

现有 `data-developer` 已实现“UI 原型必须进入用户可见结果、待确认时不得 start”的 Workflow/Skill 软门禁，但没有通用 `prototype/` 目录合同，也没有 CLI runtime（运行时）硬门禁。新 Task 应在此基础上补齐，而不是重复 PRD 文案改造。

## 当前 Task 结构

- `.trellis/workflow.md:42` 枚举 `task.json`、`prd.md`、可选 `design.md` / `implement.md` / `research/` 和 Context manifests，没有 `prototype/`。
- `packages/cli/src/templates/common/bundled-skills/trellis-meta/references/local-architecture/task-system.md:5-29` 的标准目录表同样没有 `prototype/`。
- 当前仓库没有通用 `prototype/` 目录生成或 manifest 规则。

## 当前软门禁

- `.trellis/workflow.md:341,717` 要求 UI Task 在用户确认前保持 `prototype status: pending_user_approval`，并禁止运行 `task.py start`。
- `packages/cli/src/templates/common/skills/brainstorm.md:135,225` 及中文镜像表达相同规则。
- `packages/cli/src/templates/common/prd-contract.json:8` 只有 `uiPrototypeApprovalRequired: true` 布尔合同。
- `packages/cli/scripts/check-prd-contract.mjs:25,41-42` 只验证各模板包含这段语义文字，不检查单个 Task 的目录、原型文件或批准事实。

## 当前 start 行为

- `packages/cli/src/templates/trellis/scripts/task.py:74-142` 的 `cmd_start` 只解析 Task、处理 session identity、设置活动指针、把 `planning` 改为 `in_progress` 并触发 `after_start`。
- 正常分支和 degraded mode 都没有读取 prototype 状态。
- `packages/cli/test/regression.test.ts:1686-1754` 明确锁定 degraded mode 可以把 `planning` 改为 `in_progress`。
- `packages/cli/test/regression.test.ts:2001-2065` 锁定 create 后 start 的指针幂等和状态切换；新增门禁不能破坏非 UI 路径。

## 当前 validate 与 metadata 能力

- `packages/cli/src/templates/trellis/scripts/common/task_context.py:114-154` 的 `cmd_validate` 只校验 `implement.jsonl` / `check.jsonl` 和记录分支，不应被隐式扩展成所有 Task 的语义校验器。
- `packages/cli/src/templates/trellis/scripts/common/task_store.py:239-285` 已支持 `create --meta key=value`，Task 数据写入现有 `meta` 扩展字段。
- `packages/cli/test/scripts/task-meta.integration.test.ts` 已覆盖 `create --meta` 和 `set-meta`，可作为显式 UI 标记的兼容基础。
- `.trellis/spec/cli/backend/workflow-state-contract.md:165-195` 记录全部 status writer 与 lifecycle hook 语义；接入 start gate 时必须同步该合同。

## 历史决策

- 归档 Task `.trellis/tasks/archive/2026-07/07-29-unify-prd-human-readable-contract/design.md:140-147` 明确当时只建设 planning rule，不新增 lifecycle status。
- 同一 Task 的 `research/evidence.md:96-109` 决定保持 `task.py validate` 的 JSONL Context 职责不变，并以 source-level checker 验证模板语义。
- 本 Task 的新增价值是保留这些决策，同时把单个显式 UI Task 的 prototype 事实校验接入 `task.py start`。

## 工具状态

- 2026-08-01 现场没有可调用的 GitNexus MCP 工具，仓库也不存在 `.gitnexus/run.cjs`；实施前修改任意 function/class/method（函数/类/方法）仍必须恢复可用的 impact 分析路径，或先解决索引工具缺口。

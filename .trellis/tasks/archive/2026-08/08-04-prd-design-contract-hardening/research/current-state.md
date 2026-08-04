# 当前状态与证据

## 1. Prototype 前置能力

- session `019fb7d3-6ab2-7772-b223-c0330adcae85` 已完成 prototype 标准目录、摘要绑定批准、`prototype-status`、`approve-prototype` 和 `task.py start` 前置校验的实现与验证。
- 当前真实 Task `.trellis/tasks/08-01-ui-prototype-directory-start-gate/task.json` 仍是 `in_progress`，`commit` 与 `pr_url` 为空。
- 当前普通仓库目录仍保留该 Task 的未提交源码、模板、测试、dogfood 和文档改动；因此只能表述为“本地实现与验证完成”，不能表述为已提交、合并、发布或正式交付完成。
- 既有门禁只验证 `prototype/manifest.json`、产物、摘要和批准状态；没有验证 PRD“用户可见结果”是否真实包含 prototype 入口、预览、摘要和状态。

## 2. PRD 合同缺口

- `packages/cli/src/templates/common/prd-contract.json` 当前只规定三段固定顺序、目标/结果列表样式、prototype 生命周期、技术内容下沉和 Mermaid 关键路径样式。
- `packages/cli/scripts/check-prd-contract.mjs` 当前检查模板传播和真实 Task skeleton，但不检查具体 Task PRD 的需求分类编号、结果映射或 prototype 在用户可见结果中的位置。
- `packages/cli/test/templates/prd-contract.test.ts` 已覆盖章节顺序、UI 批准入口、Mermaid 红色关键路径和合同变异；尚未覆盖本 Task 新增的编号、交互变化图触发或数据设计规则。

## 3. 轻量/复杂任务缺口

- `.trellis/workflow.md` 允许 lightweight Task 仅有 PRD，并要求 complex Task 在 start 前具有 PRD、design 和 implement，但没有可机器执行的分类依据。
- 历史设计 `.trellis/tasks/archive/2026-05/05-10-task-artifacts-and-tiers/design.md` 明确选择“不引入新的 persistent artifact metadata”，只通过对话、产物存在性和 workflow 判断；这导致当前系统无法区分“合法轻量 Task”和“复杂 Task 规划未完成”。
- 当前 `task.py start` 只对 `meta.ui=true` 调用 prototype validator，没有读取轻量/复杂分类或数据库/交互规划合同。

## 4. 数据库设计缺口

- 当前 Brainstorm/Workflow 仅说明数据契约与技术设计进入 `design.md`，未规定 DDL 必须带表/字段说明。
- SQL 方言对注释语法支持不同：支持原生 `COMMENT` 的方言应使用原生表/字段注释；SQLite 等不持久化字段注释的方言需要在 DDL 中保留 SQL 注释，并补一份结构化字段说明。
- ER 图能帮助多表关系审阅，但用户已明确它是可选项，不应成为所有数据模型 Task 的 start 硬门禁。

## 5. GitNexus 影响证据

- 索引对应当前 commit `2194237`，状态为 up-to-date。
- `cmd_start`、`cmd_create`、`validateContract`、`getAllScripts` 的 upstream impact 均为 `LOW`。
- 这些结论是单符号结果；实现触及 CLI 主分发、模板传播和 Task 生命周期，完成前仍必须运行 `detect_changes()`，不得用单符号 LOW 代替整体风险判断。

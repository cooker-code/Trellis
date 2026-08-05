# 当前实现证据

- `packages/cli/src/templates/trellis/scripts/common/task_store.py:470` 的 `cmd_create` 在目录、`task.json` 和 PRD 已写入后才处理 `--parent`，仅检查父任务 JSON 是否存在；没有父任务命名校验。
- `packages/cli/src/templates/trellis/scripts/common/task_store.py:780` 的 `cmd_add_subtask` 可将两个既有 task 关联，同样没有父任务命名校验。
- `packages/cli/src/templates/trellis/workflow.md:159` 和 `workflow.zh.md:172` 说明了父子关系的用途及命令，但未定义父任务的专属名称。
- `packages/cli/test/scripts/task-list-tree.integration.test.ts:87` 覆盖树形显示和关系 JSON；当前未覆盖创建/关联时对父任务 slug 的拒绝与无部分写入保证。

结论：约束需要同时覆盖 `create --parent` 与 `add-subtask` 两个写入入口；仅修改工作流文档无法阻止绕过。父 task 的专属前缀已由需求确认从 `epic-` 调整为 `story-`。

## 实施验证

- `task-parent-naming.integration.test.ts` 覆盖 `story-` 父 task 的创建与重新关联成功、普通或空后缀 `story-` 的拒绝、失败时无 child/关系残留，以及历史非 `story-` 树继续可列出。
- 关联逻辑只在未来写入路径上执行校验；现有 `list` 与归档逻辑未修改。

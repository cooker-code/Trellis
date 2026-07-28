# 委派任务不匹配

## 已解析的活动任务

`python3 ./.trellis/scripts/task.py current --source` 返回：

- Task（任务）：`.trellis/tasks/07-27-i18n-bundled-python-pr3`
- Source（来源）：`session:claude_f7ca65de-dbf9-4d8c-83f7-5b0c1c6efca4`

## 被委派的目标

委派提示将 `.trellis/tasks/07-27-i18n-common-skills-pr2` 标为活动任务，并要求生成 PR2 的规划产物。

## 阻塞约束

Research Agent（调研代理）契约要求通过 `task.py current --source` 解析活动任务，只能在该任务的 `research/` 目录保存结论，且不得编辑调研产物以外的 task 规划文件。因此，在解析出的活动任务仍为 PR3 时，本代理不能安全写入 PR2 的 `prd.md`、`design.md`、`implement.md`、`implement.jsonl` 或 `check.jsonl`。

## 调用方所需操作

请在活动任务指针设为 `.trellis/tasks/07-27-i18n-common-skills-pr2` 后重新委派，或将规划文件编辑委派给具有 task 产物写入范围的规划代理。不要启动 PR2 任务。

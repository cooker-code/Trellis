# 本地定制概述

此目录适用于在用户项目中工作的本地 AI，其中 Trellis 是通过 npm 安装的，并且 `trellis init` 已经运行。 AI 应修改项目内生成的 `.trellis/` 和平台目录，而不是 Trellis CLI 上游源代码。

## 首先确定用户实际想要更改的内容

| 用户措辞 | 首先阅读 |
| --- | --- |
| “更改 Trellis 流程/阶段/下一个 prompt” | `change-workflow.md` |
| “更改 task 创建、状态、存档或 hooks” | `change-task-lifecycle.md` |
| “AI 未读取上下文/更改注入的内容” | `change-context-loading.md` |
| “平台 hook 的行为不符合预期” | `change-hooks.md` |
| “更改实施/检查/研究 agent 行为” | `change-agents.md` |
| “添加skill/command/workflow/prompt” | `change-skills-or-commands.md` |
| “调整项目spec结构” | `change-spec-structure.md` |
| “添加团队惯例和本地注释” | `add-project-local-conventions.md` |

## 一般操作顺序

1. **确认平台和目录**：检查存在哪些目录，例如`.claude/`、`.codex/`、`.cursor/`。
2. **确认当前活动的task**：运行`python3 ./.trellis/scripts/task.py current --source`。
3. **阅读本地事实来源**：更喜欢 `.trellis/workflow.md`、`.trellis/config.yaml` 和相关平台文件。
4. **狭义修改**：仅编辑与用户请求相关的文件。
5. **同步语义**：如果共享流程发生变化，检查平台入口点是否也需要变化；如果平台条目发生变化，请检查 `.trellis/workflow.md` 是否仍然同意。

## 本地文件优先级

| 层 | 文件 |
| --- | --- |
| 工作流程 | `.trellis/workflow.md` |
| 项目配置 | `.trellis/config.yaml` |
| 任务材料 | `.trellis/tasks/<task>/` |
| 项目specs | `.trellis/spec/` |
| 运行时脚本 | `.trellis/scripts/` |
| 平台整合 | `.claude/`、`.codex/`、`.cursor/`、`.opencode/` 和类似目录 |
| 共享 skill | `.agents/skills/` |

## 默认情况下不要做的事情

- 不要编辑全局 npm 安装目录。
- 请勿编辑 `node_modules/@mindfoldhq/trellis`。
- 不要假设用户拥有 Trellis GitHub 存储库。
- 不要用默认模板覆盖用户已修改的本地文件。
- 不要将团队项目规则公开`trellis-meta`；项目规则属于 `.trellis/spec/` 或本地 skill。

## 何时检查上游来源

仅当用户明确表达以下目标之一时，才切换到上游源代码视角：

- “我想向 Trellis 发起 PR”
- “我想更改 npm 包发布内容”
- “我想分叉 Trellis”
- “我想修改`trellis init/update`的生成逻辑”

否则，默认修改用户项目内的本地 Trellis 文件。

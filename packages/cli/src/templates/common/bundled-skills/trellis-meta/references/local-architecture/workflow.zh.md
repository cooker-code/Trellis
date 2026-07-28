# 本地工作流程系统

`.trellis/workflow.md` 是用户项目内的 Trellis workflow 事实来源。 AI 不需要 Trellis 源代码来了解当前项目应如何推动 tasks 前进；这个文件就足够了。

## 档案职责

`.trellis/workflow.md` 具有三项职责：

1. **解释 workflow 阶段**：计划、执行、完成。
2. **定义 skill 路由**：当用户表达某种意图时，AI 应使用 skill 或 agent 。
3. **提供workflow-状态prompt块**：hooks可以将当前状态的prompt块注入到对话中。

## 当前阶段模型

```text
Phase 1: Plan    -> clarify what to build, produce prd.md and required research
Phase 2: Execute -> implement against the PRD and specs, then check
Phase 3: Finish  -> final verification, preserve lessons, and wrap up
```

每个阶段都包含编号的步骤，例如 `1.3 Configure context`。这些数字不是 `task.json` 中的 runtime 字段；它们是 workflow 结构，供 AI 和人类阅读。

## 技能路由

`workflow.md` 按平台功能分隔路由：

- 具有 sub-agent 支持的平台：默认分派 `trellis-implement` 进行实现，分派 `trellis-check` 进行检查。
- 不支持子agent的平台：主会话读取skills如`trellis-before-dev`，然后直接执行。

更改本地 AI 行为时，请先更新 `workflow.md` 中的路由描述，然后检查相应平台 skill、command 或 agent 文件是否需要保持同步。

## 工作流程状态提示块

`workflow.md` 的底部可以包含如下状态块：

```text
[workflow-state:no_task]
...
[/workflow-state:no_task]
```

挂钩根据当前 task 状态选择正确的块并将其注入对话中。常见的状态包括：

| 状态 | 意义 |
| --- | --- |
| `no_task` | 当前会话没有活动的 task。 |
| `planning` | task 仍处于需求、研究或上下文配置中。 |
| `in_progress` | task 已进入实施和检查。 |
| `completed` | task 已完成并等待总结或存档。 |

如果用户想要更改诸如“当没有 task 时是否创建 task”、“当可以跳过 task 创建时”或“是否需要子 agents”之类的策略，请编辑这些状态块及其上方的路由表。

## 局部修改模式

常见变化：

| 目标 | 编辑点 |
| --- | --- |
| 添加一个阶段 | 更新阶段索引、阶段主体、路由和状态块。 |
| 更改 task 创建策略 | 更新 `no_task` 状态块和阶段 1 描述。 |
| 更改默认实现/检查路径 | 更新第 2 阶段和 skill 路由。 |
| 更改总结流程 | 更新第 3 阶段和 `finish-work` 相关描述。请注意当前的划分：阶段 3.4 = AI 驱动的代码提交（批量、用户确认），阶段 3.5 = `/finish-work` （存档 + 记录会话）。如果工作树脏了，`/finish-work` 将拒绝运行。 |
| 改变平台差异 | 更新按平台分组的路由描述。 |

编辑完成后，使AI重读`.trellis/workflow.md`；不要假设旧对话的流程仍然有效。

## 与平台文件的关系

`workflow.md`是本地workflow的语义中心，但是每个平台也可以有自己的入口文件：

- skills，例如`trellis-brainstorm`和`trellis-check`。
- commands/prompts/工作流程，例如继续和完成工作。
- hooks，例如会话启动或 workflow 状态注入。

如果仅 `workflow.md` 发生变化，平台入口文件可能仍包含旧语言。当用户想要更改“AI 实际执行的操作”时，还要检查相关平台目录。

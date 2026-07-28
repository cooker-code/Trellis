# 本地上下文注入系统

Trellis 上下文注入的目的是使 AI 在正确的时间读取正确的文件，而不是依赖于模型内存。在用户项目中，注入是通过 `.trellis/` 脚本与平台 hooks、agents 和 skills 一起实现的。

## 注入的上下文类型

| 类型 | 来源 | 目的 |
| --- | --- | --- |
| 会话上下文 | `.trellis/scripts/get_context.py` | 当前开发人员、git 状态、活动 task、活动 tasks、日志、包。 |
| workflow 上下文 | `.trellis/workflow.md` | 当前 Trellis 流程和下一步操作。 |
| spec 上下文 | `.trellis/spec/` + task JSONL | 实施/检查期间必须遵循的规范。 |
| task 上下文 | `.trellis/tasks/<task>/prd.md`、`design.md`、`implement.md`、`research/` | 当前 task 需求、设计、执行计划和研究。 |
| 平台环境 | 平台hooks/settings/agents | 让不同的 AI 工具通过自己的机制读取上述文件。 |

## 会话开始

当会话启动、清除、压缩或接收类似事件时，具有会话启动支持的平台会注入 Trellis 概述。注入的内容通常包括：

- workflow 摘要。
- 当前 task 状态。
- 活跃 tasks。
- spec 索引路径。
- 开发者身份和 git 状态。

如果用户感觉 AI 不知道新会话中当前的 task，请首先检查平台的会话启动 hook 或等效机制是否已安装并运行。

## workflow-状态

workflow-state 是在每个用户回合周围注入的轻量级提示。根据当前 task 状态，它从 `.trellis/workflow.md` 中选择一个块，例如 `no_task`、`planning`、`in_progress` 或 `completed`。

如果用户想要更改“AI 在给定状态下下一步应该做什么”，请首先编辑 `.trellis/workflow.md` 中相应的状态块。

## 子 agent 上下文

实施并检查 agents 需要 task 上下文。 Trellis 有两种加载模式：

1. **hook 推送**：平台 hook 注入 jsonl 引用的文件以及 `prd.md`、`design.md`（如果存在）和 `implement.md`（如果在 agent 启动之前存在）。
2. **agent pull**：agent 定义要求 agent 启动后读取 active task、JSONL 上下文和 task 产物。

在这两种模式下，task 目录中的 JSONL 文件都是 spec/research 上下文清单。task 产物按以下顺序单独读取：`prd.md` -> `design.md if present` -> `implement.md if present`。

## JSONL 读取规则

`implement.jsonl` 和 `check.jsonl` 每行包含一个 JSON 对象：

```jsonl
{"file": ".trellis/spec/backend/index.md", "reason": "Backend rules"}
```

读者应跳过没有 `file` 字段的种子行。配置JSONL时，AI应仅包含spec/research文件，而不是预注册将要修改的代码文件。

## 活动任务和上下文键

活动 task 状态位于 `.trellis/.runtime/sessions/` 中，并且每个会话都是隔离的。挂钩尝试从平台事件、环境变量、脚本路径或 `TRELLIS_CONTEXT_ID` 解析上下文键。

如果 shell commands 无法看到相同的上下文键，`task.py current --source` 可能会报告没有活动的 task。在这种情况下，请检查平台是否将会话身份传递到 shell，而不是手写全局 current-task 文件。

## 本地定制点

| 需要 | 编辑位置 |
| --- | --- |
| 更改会话开始注入的内容 | 平台的 `session-start` hook 或插件文件。 |
| 更改每回合 workflow 状态规则 | `[workflow-state:STATUS]` 块位于 `.trellis/workflow.md` 中。平台 workflow-state hook 逐字解析这些块并且不嵌入后备文本。 |
| 更改 sub-agents 读取上下文的方式 | 平台 agent 定义、`inject-subagent-context` hook 或 agent 前奏。 |
| 更改 JSONL 验证/显示 | `.trellis/scripts/common/task_context.py`。 |
| 更改活动 task 分辨率 | `.trellis/scripts/common/active_task.py`。 |

修改上下文注入时，请验证两件事：新会话能看到正确的 task，sub-agents 能看到正确的 task 产物/spec/research。

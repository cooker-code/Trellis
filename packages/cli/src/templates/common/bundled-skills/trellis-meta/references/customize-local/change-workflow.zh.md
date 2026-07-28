# 改变本地工作流程

当用户想要更改 Trellis 阶段、下一步操作提示、是否创建 tasks、是否使用子 agents 或何时检查/总结时，请先编辑 `.trellis/workflow.md`。

## 首先阅读这些文件

1. `.trellis/workflow.md`
2. 当前平台的入口文件，如skills/commands/prompts/workflows
3. 当前 task 的 `task.json` 和 `prd.md`

## 常见需求及编辑要点

| 需要 | 编辑点 |
| --- | --- |
| 更改阶段名称或顺序 | `Phase Index` 和对应的阶段章节。 |
| 更改没有task时是否创建task | `[workflow-state:no_task]` 状态块。 |
| 在计划期间更改下一步 | 第 1 阶段和 `[workflow-state:planning]`。 |
| 更改 in_progress 期间是否需要 agent | 第 2 阶段和 `[workflow-state:in_progress]`。 |
| 完成后更改总结 | 第 3 阶段和 `[workflow-state:completed]`。 |
| 更改用户意图触发的 skill | `Skill Routing` 表。 |

## 修改步骤

1. 在 `.trellis/workflow.md` 中查找相关部分。
2. 更改规则时，请保留明确的触发条件和下一步操作。
3. 如果添加或重命名skill/agent，请同步平台目录中的相应文件。
4. 工作流程状态更改只需要编辑 `.trellis/workflow.md` 中的 `[workflow-state:STATUS]` 块。 hook 仅供解析器使用——它读取您放入块中的任何内容。保持开始和结束标签的 STATUS 字符串相同 (`[workflow-state:foo]…[/workflow-state:foo]`)；不匹配的 STATUS 对会被默默丢弃。
5. 使 AI 重读 `.trellis/workflow.md`；不要继续使用旧对话中的规则。

## 示例：放宽任务创建要求

要更改何时可以跳过 task 创建，通常编辑 `[workflow-state:no_task]`：

```md
[workflow-state:no_task]
Task is not required when the answer is a one-reply explanation, no files are changed, and no research is needed.
[/workflow-state:no_task]
```

如果正式的第一阶段流程也需要改变，则同步第一阶段部分。

## 示例：一个平台不使用子代理

如果用户只希望一个平台避免子agents，请首先确认该平台在workflow中是否有单独的组。然后更改该平台组的第 2 阶段路由，而不是跨平台删除所有 `trellis-implement` / `trellis-check` 指令。

## `/trellis:continue` 路由表

`/trellis:continue` 通过判断下一步应加载哪个阶段步骤来恢复 task。该判断会结合 `task.json.status` 与 task 目录中已有的产物。映射固定在 command 本身中；添加自定义状态的分支时，必须同时扩展 workflow.md 标记块和此表。

| `status` | 产物状态 | 恢复位置 |
| --- | --- | --- |
| `planning` | `prd.md` 缺失 | 阶段 1.1（加载 `trellis-brainstorm`） |
| `planning` | 轻量级 task 与 `prd.md` 完整 | 要求开始审核，然后运行 ​​`task.py start` |
| `planning` | 复杂 task 缺少 `design.md` 或 `implement.md` | 补齐缺失的规划产物 |
| `planning` | 复杂 task 具有 `prd.md`、`design.md` 和 `implement.md` | 要求开始审核，然后运行 ​​`task.py start` |
| `in_progress` | 对话历史记录中没有实施 | 阶段 2.1 (`trellis-implement`) |
| `in_progress` | 实施完成，没有 `trellis-check` 运行 | 阶段 2.2 (`trellis-check`) |
| `in_progress` | 检查通过 | 阶段 3.1（验证质量 + spec 更新） |
| `completed` | task 仍在活动树中 | 阶段 3.5（运行 `/trellis:finish-work` 进行归档） |

添加自定义状态（例如 `in-review`）时，请在 `.trellis/workflow.md` 中为每轮面包屑添加 `[workflow-state:in-review]` 块，并扩展此路由表 - 通常通过编辑 `/trellis:continue` command 文件（`.{platform}/commands/trellis/continue.md` 或等效项）添加决定从何处恢复的行。如果没有路由条目，`/trellis:continue` 将进入默认分支，用户将不会到达您想要的步骤。

## 笔记

`.trellis/workflow.md` 是本地项目 workflow，不是不可变的模板。用户可以根据团队习惯进行调整。编辑后，平台条目文件可能仍包含旧的描述，因此也要检查它们。

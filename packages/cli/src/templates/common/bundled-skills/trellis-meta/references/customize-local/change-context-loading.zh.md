# 更改本地上下文加载

上下文加载确定 AI 何时读取 workflow、task、spec、研究、工作区和 git 状态。当用户说“AI 不知道当前的 task”、“agent 没有读取 specs”或“上下文太多/太少”时，请阅读此页面。

## 首先阅读这些文件

1. `.trellis/workflow.md`
2. `.trellis/scripts/get_context.py`
3. `.trellis/scripts/common/session_context.py`
4. `.trellis/scripts/common/task_context.py`
5. `.trellis/scripts/common/active_task.py`
6. 当前平台 hooks 或 agent 文件
7. 当前 task 的 `implement.jsonl` / `check.jsonl`

## 上下文来源

| 来源 | 目的 |
| --- | --- |
| `.trellis/workflow.md` | 工作流程和下一步操作提示。 |
| `.trellis/tasks/<task>/prd.md` | 当前 task 要求。 |
| `.trellis/tasks/<task>/design.md` | 复杂的 task 技术设计。 |
| `.trellis/tasks/<task>/implement.md` | 复杂的 task 执行计划。 |
| `.trellis/tasks/<task>/implement.jsonl` | 实施前要阅读的规范/研究。 |
| `.trellis/tasks/<task>/check.jsonl` | 检查期间要阅读的规范/研究。 |
| `.trellis/spec/` | 项目specs。 |
| `.trellis/workspace/` | 会话记录。 |
| git 状态 | 当前工作树发生变化。 |

## 常见需求及编辑要点

| 需要 | 编辑点 |
| --- | --- |
| 在新会话中注入更多/更少的信息 | `session_context.py` 或平台 `session-start` hook。 |
| 更改每个用户输入的提示 | `[workflow-state:STATUS]` 块位于 `.trellis/workflow.md` 中。 `inject-workflow-state` hook 仅用于解析器并逐字读取块。 |
| 代理未读取 _​​_TRELLIS_TOKEN_000__ | 任务 JSONL、agent 前奏、`inject-subagent-context` hook。 |
| 活动 task 丢失 | `active_task.py` 和平台会话身份传播。 |
| 更改 JSONL 验证规则 | `task_context.py`。 |

## JSONL 规则

`implement.jsonl` / `check.jsonl` 是关键的上下文加载接口：

```jsonl
{"file": ".trellis/spec/backend/index.md", "reason": "Backend conventions"}
{"file": ".trellis/tasks/04-28-x/research/api.md", "reason": "API research"}
```

仅包含 spec/research 文件。不要将要修改的代码文件放入这些清单中； agents 在实现过程中自行读取代码文件。

## 更改会话上下文

如果用户希望每个新会话都能看到更多项目状态，请编辑：

- `.trellis/scripts/common/session_context.py`
- 对应平台 `session-start` hook

上下文不能无限制地增长。更喜欢注入索引和路径，以便 AI 可以按需读取详细文件。

## 更改子代理上下文

首先确定平台采用哪种模式：

- hook 推送：编辑 `inject-subagent-context` hook。
- agent pull：编辑对应`trellis-implement` / `trellis-check` agent文件中的读取步骤。

在这两种模式下，请确保 agent 最终显示为：

1. 活跃 task
2. 对应的 JSONL
3. spec/JSONL 引用的研究
4. `prd.md`
5. `design.md` 如果存在
6. `implement.md` 如果存在

## 故障排除顺序

```bash
python3 ./.trellis/scripts/task.py current --source
python3 ./.trellis/scripts/task.py list-context <task>
python3 ./.trellis/scripts/task.py validate <task>
python3 ./.trellis/scripts/get_context.py --mode packages
```

在编辑 hooks/agents 之前，请确认 task 和 JSONL 正确无误。

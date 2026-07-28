# 更改本地任务生命周期

任务生命周期包括创建、启动、上下文配置、完成、存档、父/子 tasks 和生命周期 hooks。默认自定义目标为 `.trellis/tasks/`、`.trellis/config.yaml` 和 `.trellis/scripts/`。

## 首先阅读这些文件

1. `.trellis/workflow.md`
2. `.trellis/config.yaml`
3. `.trellis/scripts/task.py`
4. `.trellis/scripts/common/task_store.py`
5. `.trellis/scripts/common/task_utils.py`
6. 当前 task 的 `.trellis/tasks/<task>/task.json`

## 常见需求及编辑要点

| 需要 | 编辑点 |
| --- | --- |
| 创建 task 之后自动同步外部系统 | `hooks.after_create` 在 `.trellis/config.yaml` 中。 |
| task 启动后自动更新状态 | `hooks.after_start` 在 `.trellis/config.yaml` 中。 |
| task 完成后运行脚本 | `hooks.after_finish` 在 `.trellis/config.yaml` 中。 |
| 归档后清理外部资源 | `hooks.after_archive` 在 `.trellis/config.yaml` 中。 |
| 更改默认 task 字段 | `.trellis/scripts/common/task_store.py`。 |
| 更改 task 解析/搜索 | `.trellis/scripts/common/task_utils.py`。 |
| 更改活动的 task 行为 | `.trellis/scripts/common/active_task.py`。 |

## 生命周期 hooks

`.trellis/config.yaml` 支持：

```yaml
hooks:
  after_create:
    - "python3 .trellis/scripts/hooks/my_sync.py create"
  after_start:
    - "python3 .trellis/scripts/hooks/my_sync.py start"
  after_finish:
    - "python3 .trellis/scripts/hooks/my_sync.py finish"
  after_archive:
    - "python3 .trellis/scripts/hooks/my_sync.py archive"
```

钩子commands接收`TASK_JSON_PATH`环境变量，指向当前task的`task.json`。挂钩失败通常应该发出警告，但不会阻止主要的 task 操作。

## 更改任务字段

如果用户想要添加项目本地字段，最好将它们放在 `task.json` 中的 `meta` 下，以避免破坏现有脚本对标准字段的假设。

例子：

```json
"meta": {
  "linearIssue": "ENG-123",
  "risk": "high"
}
```

如果标准字段确实需要更改，请检查每个读取 `task.json` 的本地脚本。

## 更改活动任务

活动 task 是存储在 `.trellis/.runtime/sessions/` 中的会话级状态。不要退回到全局 `.current-task` 模型。如果用户想要更改活动的 task 行为，请编辑：

- `.trellis/scripts/common/active_task.py`
- 平台 hooks 或 shell 会话桥
- `.trellis/workflow.md` 中的活动 task 描述

### `task.py create` 设置活动指针

`.trellis/scripts/common/task_store.py` 中的 `cmd_create` 在写入新的 task 目录后立即尽力调用 `set_active_task` 。行为：

- 当调用 shell 携带会话标识（`TRELLIS_CONTEXT_ID` env var，或 `resolve_context_key` 识别的任何特定于平台的会话环境 — 请参阅 `active_task.py:_ENV_SESSION_KEYS`）时，`.trellis/.runtime/sessions/<context_key>.json` 处的每个会话指针将被重写以指向新的 task。 task 的 `status=planning` 和 `[workflow-state:planning]` 在下一个 `UserPromptSubmit` 上触发。
- 当会话身份不可用时（在 AI 会话外部调用原始 CLI ，或在不将身份传播到 shell 的平台上），仍会创建 task 目录并写入 `status=planning` ，但活动指针保持不变。用户返回 AI 会话后，可以稍后将 task 与 `task.py start <dir>` 附加在一起。

这使得 `[workflow-state:planning]` 成为头脑风暴期间的实时面包屑，以及 `task.py create` 之后的 JSONL 策展工作。 R7 之前的行为使面包屑停留在 `no_task` 上，直到 `task.py start` 为止，因此规划块实际上是死文本。

如果您分叉 `task.py` 以添加新的创建路径（例如绕过 `cmd_create` 的外部导入），请审核您的路径是否也调用 `set_active_task`。如果没有该调用，您创建的 tasks 将不会显示为活动状态。完整的状态写入器表位于 `.trellis/spec/cli/backend/workflow-state-contract.md` 中。

## 修改步骤

1. 使用 `python3 ./.trellis/scripts/task.py current --source` 确认当前的 task。
2. 读取当前 task 的 `task.json` 并确认状态和字段。
3. 对于配置需要，请先编辑 `.trellis/config.yaml`。
4. 对于脚本行为需求，然后编辑 `.trellis/scripts/`。
5. 如果 AI 流发生更改，请同步 `.trellis/workflow.md`。

## 不要

- 不要直接编辑 `.trellis/.runtime/sessions/` 来“修复”业务状态。
- 不要将项目私有字段硬编码到脚本中；更喜欢`meta`。
- 不要默认要求用户分叉 Trellis CLI。

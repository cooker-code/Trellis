# 更改本地挂钩

挂钩是将平台连接到 Trellis 的自动化层。当用户想要更改“何时注入上下文”、“shell commands 如何继承会话”或“在 agent 启动之前读取哪些文件”时，hooks 通常是编辑点。

## 首先阅读这些文件

1. 目标平台设置/配置，例如 `.claude/settings.json`、`.codex/hooks.json`、`.cursor/hooks.json`
2. 目标平台hooks目录
3. `.trellis/scripts/common/active_task.py`
4. `.trellis/scripts/common/session_context.py`
5. `.trellis/workflow.md`

## 常见的钩子类型

| 钩 | 目的 |
| --- | --- |
| 会话开始 | 当会话启动、清除或压缩时注入 Trellis 概述。 |
| workflow-状态 | 在每个用户输入上注入状态提示。 |
| 子 agent 上下文 | 在 agent 开始之前注入 PRD/spec/research。 |
| shell会话桥 | 让 shell 中的 `task.py` commands 看到相同的会话标识。 |

## 修改步骤

1. 在 settings/config 中找到 hook 注册。
2. 确认注册的脚本路径存在。
3. 读取 hook 脚本并识别输入、输出，并调用 `.trellis/scripts/`。
4. 修改 hook 行为。
5. 如果hook依赖于workflow内容，则同步`.trellis/workflow.md`。

## 示例：更改新会话注入内容

首先找到会话启动hook：

```text
.claude/settings.json
.claude/hooks/session-start.py
```

如果 hook 最终调用 `.trellis/scripts/get_context.py` 或 `session_context.py`，则编辑本地脚本通常比在 hook 中硬编码内容更可靠。

## 示例：代理未读取 _​​_TRELLIS_TOKEN_000__

首先确认：

```bash
python3 ./.trellis/scripts/task.py current --source
python3 ./.trellis/scripts/task.py validate <task>
```

如果task和JSONL正确，请确定平台是否使用hook推送或agent拉取。对于 hook 推送，编辑 `inject-subagent-context`；对于 agent 拉取，编辑 agent 文件。

## 笔记

- 设置处理注册，hook 脚本处理行为；一起检查。
- 不同的平台支持不同的 hook 事件。不要直接复制其他平台的设置。
- 挂钩应读取项目本地 `.trellis/`；它们不应依赖于 Trellis 上游源路径。
- 挂钩失败应该会产生可见错误，因此 AI 不会默默地丢失上下文。

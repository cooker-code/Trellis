---
name: trellis-channel
description: 使用 Trellis channel（通道）进行实时多智能体协作、派生 worker（工作代理）、跨代理审查、进度检查、论坛通道和日志排障。
---

# trellis-channel

`trellis channel` 是本地多智能体协作运行时。当代理需要通过持久事件日志讨论、将 worker 作为同级进程派生、检查或中断运行中的 worker，或把反馈记录到 `--type forum` 通道时使用它。

这是索引技能。只加载当前工作所需的参考文件，不要预加载全部文件。

## 首先执行的命令

```bash
trellis --version
trellis channel --help
trellis channel list --all
trellis channel list --scope global --all
```

若用户给出通道或 thread（线程），先检查它：

```bash
trellis channel forum <board> --scope global
trellis channel thread <board> <thread> --scope global
trellis channel context list <board> --scope global --thread <thread>
```

## 按用户意图选择参考

| 用户意图 | 读取文件 |
|---|---|
| 讨论、brainstorm（头脑风暴） | `references/workflows.md` |
| 派 implement/check agent 或审查 | `references/workflows.md`，再读 `references/workers.md` |
| 创建论坛、议题板或变更日志 | `references/forum.md` |
| 检查 thread 或关联上下文 | `references/forum.md` |
| 通道卡住、没有输出、进度被截断 | `references/progress-debugging.md` |
| 查询具体命令和参数 | `references/command-reference.md` |

## 核心规则

- 新论坛通道使用 `--type forum`；`thread` 是论坛通道中的一个条目。
- 使用 `--context-file` / `--context-raw` 以及 `trellis channel context add/delete/list`；`--linked-context-*` 已弃用。
- 长消息使用 `--stdin` 或 `--text-file`，不要放入位置参数。
- `messages` 的美化输出可能截断进度；审计时使用 `--raw`。
- `--as` 是发言者或 worker 名称；多人协作时使用明确且稳定的名称。
- `--scope project`（默认）作用于当前 cwd 的项目桶；`--scope global` 作用于共享 `__global__` 桶。
- brainstorm 需要多轮压力测试；一次回答加一次确认只是 review（审查）。
- **调度等待规则**：使用 Trellis 自动产生的 `--kind done` / `--kind turn_finished`，不要把用户 `--tag` 当完成信号。详见 `references/command-reference.md` 的 tag 与 kind 说明。
- 论坛通道采用事件溯源；优先使用 `forum`、`thread`、`messages --thread` 和 `context list`，不要先解析 `events.jsonl`。
- `@mindfoldhq/trellis-core` 管理可复用的通道、线程和事件状态；CLI 管理参数、终端渲染、提示、worker 生命周期和退出码。

## 参考文件

- `references/workflows.md`：协作模式。
- `references/forum.md`：论坛、上下文、标题和线程。
- `references/workers.md`：派生、上下文注入、中断与终止语义。
- `references/progress-debugging.md`：进度检查、卡住诊断和退出码。
- `references/command-reference.md`：完整命令参考。

## 不适用的情况

- 单次静态审查，直接阅读 Markdown（标记语言）文件和提示即可。
- 用自我记录替代正常工具调用。
- 长期记忆检索；可操作问题使用论坛通道，历史会话检索使用 `trellis mem`（`trellis-session-insight` 技能）。

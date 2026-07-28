# 命令参考

本文件是 `trellis channel` 子命令的参考。所有子命令默认使用 `--scope project`，也可使用 `--scope global`。

## 基本形式

```bash
trellis channel <subcommand>
```

## 创建、列出和消息

```bash
trellis channel create <name> [--scope project|global] [--type chat|forum] [--task <path>] [--context-file <abs-path>] [--context-raw <text>] [--force] [--ephemeral]
trellis channel list [--scope project|global] [--json] [--all] [--all-projects]
trellis channel send <name> [text] --as <agent> [--to <agents,csv>] [--stdin | --text-file <path>] [--delivery-mode appendOnly|requireKnownWorker|requireRunningWorker]
trellis channel messages <name> [--raw] [--follow] [--last <N>] [--since <seq>] [--kind <kind>] [--from <csv>] [--to <target>] [--thread <key>] [--action <thread-action>] [--no-progress]
```

`create` 追加事件；`type` 创建后不可变。`--ephemeral` 通道默认不会出现在 `list`。长消息优先使用 `--stdin` 或 `--text-file`。`messages --raw` 每行输出一个 JSON（JavaScript Object Notation）事件。

## 等待与事件类型

```bash
trellis channel wait <name> --as <agent> [--timeout <Ns|Nm|Nh|Nms>] [--from <a,b>] [--kind <k1,k2>] [--thread <key>] [--action <thread-action>] [--to <target>] [--include-progress] [--all]
```

`wait` 输出匹配的 JSON 事件；`--all` 等待每个 `--from`，超时退出码为 `124`。`--kind` 是唯一的事件类型筛选器；不要假设存在 `--tag`。调度 worker 完成时使用 `--kind done,turn_finished`。

## Worker

```bash
trellis channel spawn <name> [--agent <agent-name>] [--provider claude|codex] [--as <worker-name>] [--cwd <path>] [--model <id>] [--resume <id>] [--timeout <Ns|Nm|Nh>] [--file <path>] [--jsonl <path>] [--inbox-policy explicitOnly|broadcastAndExplicit]
trellis channel run [name?] [--agent <name>] [--provider claude|codex] [--as <worker-name>] [--message <text> | --message-file <path> | --stdin]
trellis channel interrupt <name> [text] --as <agent> --to <agent> [--stdin | --text-file <path>]
trellis channel kill <name> --as <agent> [--force]
```

`spawn` 后 worker 会等待第一个 `send --to <worker>`。`interrupt` 用于软中断和重定向；无法收敛时可用 `kill`，再通过 `--resume <id>` 恢复。实际参数以 `trellis channel --help` 为准。

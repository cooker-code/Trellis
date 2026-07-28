# 进度与排障

当 worker（工作代理）卡住、没有输出或进度被截断时，先使用 CLI（命令行工具）检查事件，而不是猜测。

```bash
trellis channel list --all
trellis channel messages <channel> --raw --last 100
trellis channel messages <channel> --raw --follow
trellis channel wait <channel> --as main --kind done,turn_finished --timeout 5m
```

美化的 `messages` 输出是操作面板，可能折叠 `progress` 事件；审计时使用 `--raw`。检查最后的 `progress`、`error`、`done`、`turn_finished`、`interrupted` 和 `supervisor_warning` 事件，以及 worker 的 `pid`、`worker-pid`、`log`、`session-id` 边车文件。

## 卡住时的处理

1. 确认等待命令的 `--from`、`--to` 和 `--kind` 是否匹配。
2. 使用 `interrupt` 发送明确的替代指令。
3. 若 provider（提供方）未响应，使用 `kill`；需要继续时用 `spawn --resume <id>`。
4. 记录通道、worker、最后 seq（序号）和退出码，避免丢失审计线索。

超时通常为退出码 `124`。不要将用户自定义文本或不存在的 `--tag` 当成可等待的完成事件；使用 Trellis 自动发出的 `done` / `turn_finished`。

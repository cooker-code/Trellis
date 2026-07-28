# Worker 运行说明

`trellis channel spawn` 将 worker 作为可观察、可中断的同级进程启动。使用稳定的 `--as` 名称，并通过 `--file` / `--jsonl` 注入最小必要上下文。

```bash
trellis channel create impl-task --task .trellis/tasks/05-12-foo --by main
trellis channel spawn impl-task --agent implement --provider codex --as codex-impl --jsonl .trellis/tasks/05-12-foo/implement.jsonl --file .trellis/tasks/05-12-foo/prd.md --cwd "$PWD" --timeout 15m
trellis channel send impl-task --as main --to codex-impl --text-file /tmp/brief.md
trellis channel wait impl-task --as main --from codex-impl --kind done,turn_finished --timeout 15m
```

## 收件箱与投递

- `--inbox-policy explicitOnly`（默认）只接收 `send --to <worker>` 或 `interrupt --to <worker>`。
- `broadcastAndExplicit` 也接收未指定 `--to` 的广播。
- `--delivery-mode appendOnly` 仅追加事件；`requireKnownWorker` 与 `requireRunningWorker` 会验证目标状态。

## 资源保护

worker OOM（内存不足）保护在每次 `spawn` 时执行：`--idle-timeout` 清理空闲 worker，`--max-live-workers` 限制项目桶中的存活数。优先级是 CLI 参数、环境变量 `TRELLIS_CHANNEL_WORKER_IDLE_TIMEOUT` / `TRELLIS_CHANNEL_MAX_LIVE_WORKERS`、`.trellis/config.yaml` 的 `channel.worker_guard`、内置默认值。

软重定向使用 `interrupt`；出现失控循环时使用 `kill`，随后可使用 `--resume` 恢复会话。不要删除日志或 session-id，它们用于审计和恢复。

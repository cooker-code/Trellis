# 协作工作流

按意图选择下列模式。多轮工作使用持久通道，单次问题使用 `channel run`。

## 模式 A：多轮 brainstorm

```bash
trellis channel create brainstorm-storage-layer --by main --task .trellis/tasks/05-XX-storage-adapter
trellis channel spawn brainstorm-storage-layer --agent architect --provider codex --file .trellis/tasks/05-XX-storage-adapter/prd.md --file .trellis/tasks/05-XX-storage-adapter/design.md --as cx-arch --timeout 30m
trellis channel send brainstorm-storage-layer --as main --to cx-arch --text-file /tmp/brainstorm-r1.md
trellis channel wait brainstorm-storage-layer --as main --kind done --from cx-arch --timeout 10m
```

至少依次确认方案归属、MVP（最小可行产品）边界、数据契约、CLI / UX（用户体验）契约、跨层风险与测试。不要在一轮回答后停止。

## 模式 B：实施或检查 agent

```bash
TASK=.trellis/tasks/05-12-foo
trellis channel create cr-foo --task "$TASK" --by main
trellis channel spawn cr-foo --agent check --jsonl "$TASK/check.jsonl" --file "$TASK/prd.md" --file "$TASK/design.md" --file "$TASK/implement.md" --cwd "$PWD" --timeout 15m
trellis channel send cr-foo --as main --to check --text-file /tmp/cr-brief.md
trellis channel wait cr-foo --as main --kind done --from check --timeout 15m
```

实施使用 `--agent implement`；检查简报应包含精确 diff（差异）范围、相关 spec 和已运行验证。

## 模式 C 至 F

- 多个 reviewer（审查代理）：使用同一通道和不同 worker 名称，`wait --all` 等待全部完成。
- 单次 worker：`trellis channel run --provider codex --message "say hi in 3 words" --timeout 1m`。
- 论坛：用于议题、反馈和发布待办；读取 `forum.md`。
- 接管已有 thread：依次运行 `forum`、`thread`、`context list`、`messages --raw --thread`，输出约束摘要而不是整段转录。

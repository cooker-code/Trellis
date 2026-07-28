# `trellis mem` CLI 快速参考

`trellis mem help` 的运行时输出是权威参数参考；本文件同步说明五个子命令。

## 子命令

| 命令 | 用途 |
|---|---|
| `list` | 列出会话；未指定子命令时的默认行为。 |
| `search <keyword>` | 查找内容匹配关键字的会话。 |
| `context <session-id>` | 返回命中轮次及其周边上下文。 |
| `extract <session-id>` | 导出清理后的对话，可使用 `--phase` / `--grep` 切分。 |
| `projects` | 列出有会话的项目 cwd（当前工作目录）。 |

## 常用参数

| 参数 | 适用范围 | 含义 |
|---|---|---|
| `--platform claude\|codex\|opencode\|pi\|all` | 全部 | 默认 `all`；OpenCode 当前仍是 stub（占位实现）。 |
| `--since YYYY-MM-DD` / `--until YYYY-MM-DD` | list / search | 包含边界的日期范围。 |
| `--global` / `--cwd <path>` | list / search | 搜索所有项目或指定 cwd。 |
| `--limit N` | list / search | 限制输出行数，默认 `50`。 |
| `--grep KW` | extract / context | 用关键字筛选轮次。 |
| `--phase brainstorm\|implement\|all` | extract | 按 Trellis task 边界切分，默认 `all`。 |
| `--turns N` / `--around N` / `--max-chars N` | context | 控制命中和上下文输出预算。 |
| `--include-children` | search / context | 合并 OpenCode 子代理会话。 |
| `--json` | 全部 | 输出可机器解析的 JSON。 |

## 常用示例

```bash
trellis mem search "deadlock" --global --limit 20
trellis mem context 5842592d --grep "lock contention" --turns 5 --around 2
trellis mem extract 5842592d --phase brainstorm
trellis mem projects
```

## 注意事项

- OpenCode adapter（适配器）在 `0.6.0-beta.*` 中仍不可用，工具会提示并继续检索其他平台。
- `--phase` 依赖记录的 Bash（命令行）中存在 `task.py create` / `task.py start`；没有边界时使用 `--phase all`。
- `mem` 直接索引平台 JSONL（逐行 JSON）文件；已删除的本地日志无法恢复。
- `mem` 只读，不会远端同步，也不会编辑平台 JSONL。

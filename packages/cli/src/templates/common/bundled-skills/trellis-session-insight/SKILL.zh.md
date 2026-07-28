---
name: trellis-session-insight
description: "通过 `trellis mem` CLI（命令行工具）检索过去的 AI（人工智能）对话；当用户询问上次如何解决、是否讨论过、曾经的决策、继续旧任务或复盘时使用。"
---

# Trellis 会话洞察

本技能说明 AI 如何调用 `trellis mem`，以及何时应检索项目的跨会话记忆。它是能力技能而非固定工作流：根据当前对话判断是引用、更新 task（任务）文档、沉淀规范，还是仅将结果用于回答。

## `trellis mem` 是什么

它是本地 CLI，用于索引用户过去的 Claude Code、Codex、Pi Agent 和 ZCode 对话日志，并支持列出、搜索、按 Trellis task 边界切分和导出清理后的对话。不会上传任何内容；所有读取均在本机完成。

## 何时使用

- 用户要求回忆上次解决方案、旧决策或跨会话进度。
- 新的 brainstorm 可能重复既有讨论。
- 当前 bug（缺陷）像以前处理过的问题。
- 用户明确要求本任务复盘或查找重复模式。

当前 turn（轮次）、`prd.md`、`design.md`、Git 历史或打开文件已包含答案时，不要调用它。作为拥有 `implement.jsonl` / `check.jsonl` 上下文的实施或检查子代理，通常也不需要额外调用。

## 常用命令

```bash
trellis mem search "<keyword>"
trellis mem extract <session-id> --phase brainstorm
trellis mem extract <session-id> --grep "<keyword>"
trellis mem context <session-id> --turns 3 --around 2
trellis mem list --cwd <project-path>
trellis mem projects
```

`--phase brainstorm|implement|all` 按 `task.py create` 和 `task.py start` 边界切分；默认是 `all`。完整参数请读取 `references/cli-quick-reference.md`。

## 如何使用结果

- 若旧对话直接回答当前问题，可在回复中引用并给出 session-id（会话标识）。
- 若发现关键决策缺失，可先向用户展示提议，再更新 `<task>/prd.md`、`<task>/design.md` 或 task 注记。
- 若结论属于项目级约定，使用 `trellis-update-spec` 技能写入 `.trellis/spec/`。
- 一次性检索结果通常只需吸收后用于后续回答。

## 范围外

- `mem` 不编辑代码或文件，也不向远端同步。
- 它不替代 `trellis-update-spec`，后者负责将经验沉淀为项目规范。

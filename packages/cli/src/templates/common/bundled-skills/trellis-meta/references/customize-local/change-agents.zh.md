# 更换本地代理

当用户想要更改 `trellis-research`、`trellis-implement` 或 `trellis-check` 行为时，请编辑用户项目中的平台 agent 文件。

## 首先阅读这些文件

1. 目标平台agent目录
2. `.trellis/workflow.md` 第 2 阶段/研究路由
3. 当前 task `prd.md`
4. 当前 task `implement.jsonl` / `check.jsonl`
5. 相关 hook 或 agent 前奏

## 通用路径

| 平台 | 小路 |
| --- | --- |
| Claude Code | `.claude/agents/trellis-*.md` |
| Cursor | `.cursor/agents/trellis-*.md` |
| OpenCode | `.opencode/agents/trellis-*.md` |
| Codex | `.codex/agents/trellis-*.toml` |
| Kiro | `.kiro/agents/trellis-*.json` |
| Gemini CLI | `.gemini/agents/trellis-*.md` |
| Qoder | `.qoder/agents/trellis-*.md` |
| CodeBuddy | `.codebuddy/agents/trellis-*.md` |
| Factory Droid | `.factory/droids/trellis-*.md` |
| Pi代理 | `.pi/agents/trellis-*.md` |
| Reasonix | `.reasonix/skills/trellis-*/SKILL.md`（subagent frontmatter） |
| ZCode | `.zcode/agents/trellis-*.md` |

使用用户项目中的实际路径作为权威。

## 常见需求

| 需要 | 要编辑哪个 agent |
| --- | --- |
| 研究必须写文件，不能只在聊天里回复 | `trellis-research` |
| 执行前必须读取某些本地 specs | `trellis-implement` + `implement.jsonl` 配置规则 |
| 检查期间必须运行特定的 commands | `trellis-check` |
| 代理不得修改某些目录 | 对应agent的写边界指令 |
| 代理输出格式必须固定 | 对应的agent的最终/报告指令 |

## 修改原则

1. **保留角色界限**：研究调查并坚持；实现写入实现；检查评论和修复。
2. **不要将项目 specs 硬编码到 agents**：长期 specs 属于 `.trellis/spec/`； agents 负责读取它们。
3. **明确读取顺序**：活动 task -> PRD -> 信息 -> JSONL -> spec/research。
4. **明确写入边界**：哪些目录可以写入，哪些目录不能写入。
5. **跨平台同步**：当用户配置多个平台时，决定是仅更改当前平台还是所有平台agents。

## 代理拉动平台

如果 agent 文件包含“启动后读取 task/context”的前奏，请勿在编辑时删除这些步骤。否则 agent 将仅在聊天上下文中工作并绕过 Trellis 的核心机制。

## 钩推平台

如果上下文由 hook 注入，则 agent 文件仍应保留责任边界。不要仅仅因为 hook 注入上下文而从 agent 中删除 PRD/spec 要求。

# 代理商

Trellis agent 文件定义专门的角色。用户项目中常见的 Trellis agents 有：

- `trellis-research`
- `trellis-implement`
- `trellis-check`

文件位置和格式因平台而异，但责任边界应保持一致。

## 代理人的责任

| 代理人 | 责任 |
| --- | --- |
| `trellis-research` | 调查问题并将调查结果写入当前 task 的 `research/` 中。 |
| `trellis-implement` | 针对 `prd.md`、可选 `design.md` / `implement.md`、`implement.jsonl` 和相关 spec/research 实施。 |
| `trellis-check` | 检查更改、修复发现的问题并运行必要的检查。 |

代理文件不应成为通用聊天 prompts。他们应该定义输入源、编写边界、代码是否可以更改以及如何报告结果。

## 通用路径

| 平台 | 代理路径 |
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
| Kimi Code | `.kimi-code/skills/trellis-*/SKILL.md`（Agent prompt 作为 Skill） |

GitHub Copilot agent/prompt 支持由 `.github/agents/`、`.github/prompts/` 和 `.github/skills/` 等目录组合提供；检查用户项目中实际生成的文件。

主会话 workflow 平台（例如 Kilo、Antigravity 和 Windsurf）可能没有 Trellis 子 agent 文件。他们通常依靠工作流程/skills 来指导主要会话。

## 两种上下文加载模式

### hook 推送

平台 hook 在 agent 启动之前注入 task 上下文。 agent 文件本身可以更多地关注职责和边界。

在支持 agent hooks 的平台上常见。

### agent 拉

agent 文件指示 agent 在启动后读取：

- `python3 ./.trellis/scripts/task.py current --source`
- `implement.jsonl` 或 `check.jsonl`
- spec/JSONL 引用的研究文件
- 当前 task `prd.md`
- `design.md` 如果存在
- `implement.md` 如果存在

此模式适合 hooks 无法可靠地重写子 agent prompts 的平台。

## 局部变化场景

| 用户需求 | 编辑位置 |
| --- | --- |
| 实施 agent 必须遵循额外的限制 | 平台的 `trellis-implement` agent 文件。 |
| 检查 agent 必须运行项目特定的 commands | `trellis-check` agent 文件，以及 `.trellis/spec/`（如果需要）。 |
| 研究 agent 必须输出固定格式 | `trellis-research` agent 文件。 |
| 代理无法读取 task 上下文 | 特工前奏或`inject-subagent-context` hook。 |
| 添加项目特定的 agent | 平台agent目录+相关workflow/command/skill入口点。 |

## 修改原则

1. **保持职责单一目的**。不要将研究、实施和检查职责混入一个 agent 中。
2. **指定读取顺序**。代理必须知道从活动的 task 开始，读取 jsonl/spec 上下文，然后读取 `prd.md`、`design.md`（如果存在）和 `implement.md`（如果存在）。
3. **指定写入边界**。研究通常只写`research/`；实现可以编写代码；检查可以解决问题。
4. **在多平台项目中保持语义同步**。如果用户同时配置了 Claude、Codex 和 Cursor，请确定对一个平台的 agent 的更改是否也需要应用于其他平台。

## 不要默认编辑上游模板

本地 AI 应默认修改用户项目内的平台 agent 文件。仅当用户明确希望将更改贡献回 Trellis 时，才讨论上游模板源。

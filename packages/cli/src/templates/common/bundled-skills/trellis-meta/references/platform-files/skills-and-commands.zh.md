# 技能、命令、提示和工作流程

技能和 commands 是用户与 Trellis 交互的文本入口点。不同的平台使用不同的名称，但其核心目的是相同的：告诉AI当用户表达某种意图时如何进入Trellis流程。

## 概念差异

| 类型 | 触发方式 | 最适合 |
| --- | --- | --- |
| skill | AI 自动匹配或显式用户提及 | 长期能力、workflow 规则、修改指南。 |
| command | 显式用户调用 | 清晰的继续、结束等操作入口点。 |
| prompt | 显式用户调用或平台选择 | 与 command 类似，但采用平台 prompt 格式。 |
| workflow | 显式用户选择或平台自动匹配 | 当不存在子 agent/hook 时引导主会话。 |

Trellis workflow skills 通常共享一组语义：头脑风暴、开发前、检查、更新spec、中断循环。多文件内置skills如`trellis-meta`使用分层引用。

## 通用路径

| 平台 | 常用条目 |
| --- | --- |
| Claude Code | `.claude/skills/`、`.claude/commands/` |
| Cursor | `.cursor/skills/`、`.cursor/commands/` |
| OpenCode | `.opencode/skills/`、`.opencode/commands/` |
| Codex | `.agents/skills/`、`.codex/skills/` |
| 公斤 | `.kilocode/skills/`、`.kilocode/workflows/` |
| Kiro | `.kiro/skills/` |
| Gemini CLI | `.agents/skills/`、`.gemini/commands/` |
| Antigravity | `.agent/skills/`、`.agent/workflows/` |
| Devin | `.devin/skills/`、`.devin/workflows/` |
| Qoder | `.qoder/skills/`、`.qoder/commands/` |
| CodeBuddy | `.codebuddy/skills/`、`.codebuddy/commands/` |
| GitHub Copilot | `.github/skills/`、`.github/prompts/` |
| Factory Droid | `.factory/skills/`、`.factory/commands/` |
| Pi Agent | `.agents/skills/` |
| Reasonix | `.reasonix/skills/` |
| ZCode | `.zcode/skills/`、`.zcode/commands/` |
| Kimi Code | `.agents/skills/`、`.kimi-code/skills/`（command 以 `/skill:trellis-*` Skill 形式提供） |

在用户项目中，使用init实际生成的文件作为权威。

## 技能结构

常见的 skill 是一个目录：

```text
trellis-meta/
├── SKILL.md
└── references/
```

`SKILL.md` 应该告诉 AI：

- 何时使用此 skill。
- 当前 task 首先读取哪个引用。
- 什么不该做。

参考资料承载较长的说明，因此入口文件无需包含全部内容。

## 命令/提示符/工作流程结构

命令、prompts 和工作流程通常是单个文件。其内容应包括：

- 什么时候使用它。
- 要读取哪些 `.trellis/` 文件。
- 要运行哪些脚本。
- 完成后如何报告。

他们不应该存储 task 状态； task 状态属于 `.trellis/tasks/` 和 `.trellis/.runtime/`。

## 局部变化场景

| 用户需求 | 编辑位置 |
| --- | --- |
| 更改 AI 自动触发规则 | 对应 skill 的 frontmatter 描述。 |
| 更改用户 command 行为 | 对应的 command/prompt/workflow 文件。 |
| 添加项目本地 skill | 平台 skill 目录，或共享 `.agents/skills/`。 |
| 让多个平台共享一种能力 | 在每个平台 skill 目录中写入等效的 skills ，或在支持它的平台上使用 `.agents/skills/` 共享层。 |
| 更改结束/继续入口点 | 平台commands/prompts/工作流程。 |

## 修改原则

1. **保持入口文件简短；较长内容放入参考资料**。这对于像 `trellis-meta` 这样的多文件 skills 来说尤其重要。
2. **使触发器描述具体**。过于宽泛的描述可能会误触发；太窄的可能无法触发。
3. **跨平台保持相同的语义一致**。文件格式可以不同，但​​行为描述应该匹配。
4. **将项目特定的功能放入本地 skills**。不要将团队私有流放入公共 `trellis-meta` 中。

如果用户只想让本地 AI 多知道一项项目规则，通常会创建一个项目本地 skill 或更新 `.trellis/spec/` 而不是更改 Trellis 内置 workflow skill。

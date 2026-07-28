# 更改本地技能、命令、提示和工作流程

当用户想要更改 AI 入口点、自动触发规则或显式 command 行为时，请编辑 skills、commands、prompts 或本地平台目录中的工作流。

## 首先阅读这些文件

1. `.trellis/workflow.md`
2. 目标平台skill/command/prompt/workflow目录
3. 相关 agent 或 hook 文件
4. `.trellis/spec/` 中是否已存在项目规则

## 选择哪种条目类型

| 目标 | 推荐 |
| --- | --- |
| AI 应该自动知道一个能力 | 添加或修改 skill。 |
| 用户想要使用 command 手动触发 | 添加或修改 command/prompt/workflow。 |
| 团队项目约定 | 首选 `.trellis/spec/` 或项目本地 skill，绝不要放入 bundled skill 目录。 |
| 为用户自己的项目调整 bundled skill（`trellis-meta` 等） | 创建名称不同的项目本地 Skill 来补充意图，或编辑 `.trellis/spec/`。直接修改 bundled skill 只会保留到下次 `trellis update`。 |
| 把改动贡献回上游 | 编辑 Trellis CLI 仓库中的 `packages/cli/src/templates/common/bundled-skills/<name>/`，而不是已部署的副本。 |
| 更改 Trellis 流语义 | 同步 `.trellis/workflow.md`。 |

## 修改技能

skill 通常是：

```text
<skill-name>/
├── SKILL.md
└── references/
```

`SKILL.md` 应该很短并负责触发/路由。将长内容放入 `references/` 中，以便 AI 可以按需读取。

frontmatter 描述应指定何时使用 skill。例子：

```yaml
description: "Use when customizing this project's deployment workflow and release checklist."
```

不要写“有用的项目skill”之类模糊的描述；它们可能会错误地触发。

### Bundled 与项目本地 Skill

相同的目录结构对应两种完全不同的所有权模型：

| 方面 | Bundled（`trellis-meta`、`trellis-spec-bootstrap`、`trellis-session-insight`、`trellis-channel`） | 项目本地 |
| --- | --- | --- |
| 权威来源 | Trellis CLI 仓库中的 `packages/cli/src/templates/common/bundled-skills/<name>/` | 用户项目自身 |
| 分发 | `trellis init` / `trellis update` 时由 `getBundledSkillTemplates()` 自动分发到每个平台的 Skill 根目录 | 由用户创建，且不会移动 |
| Hash 跟踪 | 每个文件都记录在 `.trellis/.template-hashes.json` 中；update 时出现冲突提示 | 不跟踪 |
| 本地编辑 | 允许，但下次 update 时会标记为“由用户修改” | 可自由编辑 |
| 正确的定制方式 | 新增名称不同的项目本地 Skill，补充或取代 bundled skill | 直接编辑文件 |

## 修改命令/提示符/工作流程

显式入口点应说明：

- 用户如何触发它。
- 要读取哪些 `.trellis/` 文件。
- 要运行哪些脚本。
- 完成后如何报告。

如果 command 仅重复 workflow 规则，则更愿意使其引用/读取 `.trellis/workflow.md` 而不是维护流程的第二个副本。

## 通用路径

| 平台 | 入口目录 |
| --- | --- |
| Claude Code | `.claude/skills/`、`.claude/commands/` |
| Cursor | `.cursor/skills/`、`.cursor/commands/` |
| OpenCode | `.opencode/skills/`、`.opencode/commands/` |
| Codex | `.agents/skills/`、`.codex/skills/` |
| Gemini CLI | `.agents/skills/`、`.gemini/commands/` |
| Kiro | `.kiro/skills/` |
| Qoder | `.qoder/skills/`、`.qoder/commands/` |
| CodeBuddy | `.codebuddy/skills/`、`.codebuddy/commands/` |
| GitHub Copilot | `.github/skills/`、`.github/prompts/` |
| Factory Droid | `.factory/skills/`、`.factory/commands/` |
| Pi Agent | `.agents/skills/` |
| Reasonix | `.reasonix/skills/`（没有独立 commands 目录；slash command 由平台内置） |
| ZCode | `.zcode/skills/`、`.zcode/commands/` |
| Kilo / Antigravity / Devin | workflows + skills |

## 添加项目本地技能

如果用户想要记录团队私有自定义，请创建项目本地 skill，例如：

```text
.claude/skills/project-trellis-local/
└── SKILL.md
```

对于多平台项目，请在每个平台 skill 目录中添加等效版本，或在支持共享层的平台上使用 `.agents/skills/` 。

## 笔记

- 不要将每个平台的语法混合到一个文件中。
- 不要在声称支持所有平台的同时只更改一个平台入口点。
- 不要将长期工程约定隐藏在 command 内；将它们写入 `.trellis/spec/`。

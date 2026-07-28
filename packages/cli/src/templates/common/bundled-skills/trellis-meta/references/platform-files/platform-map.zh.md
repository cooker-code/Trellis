# 平台文件图

此页面按平台列出了用户项目中常见的 Trellis 文件位置。实际项目中是否存在平台目录取决于用户运行的是哪个`trellis init --<platform>` commands。

## 矩阵

| 平台 | CLI 标志 | 主目录 | 技能目录 | 代理名录 | 挂钩/延长件 |
| --- | --- | --- | --- | --- | --- |
| Claude Code | `--claude` | `.claude/` | `.claude/skills/` | `.claude/agents/` | `.claude/hooks/` + `.claude/settings.json` |
| Cursor | `--cursor` | `.cursor/` | `.cursor/skills/` | `.cursor/agents/` | `.cursor/hooks.json` + `.cursor/hooks/` |
| OpenCode | `--opencode` | `.opencode/` | `.opencode/skills/` | `.opencode/agents/` | `.opencode/plugins/` |
| Codex | `--codex` | `.codex/` | `.agents/skills/` | `.codex/agents/` | `.codex/hooks/` + `.codex/hooks.json` |
| 公斤 | `--kilo` | `.kilocode/` | `.kilocode/skills/` | 通常没有 | `.kilocode/workflows/` |
| Kiro | `--kiro` | `.kiro/` | `.kiro/skills/` | `.kiro/agents/` | `.kiro/hooks/` |
| Gemini CLI | `--gemini` | `.gemini/` | `.agents/skills/` | `.gemini/agents/` | `.gemini/settings.json` + `.gemini/hooks/` |
| Antigravity | `--antigravity` | `.agent/` | `.agent/skills/` | 通常没有 | `.agent/workflows/` |
| Devin | `--devin` | `.devin/` | `.devin/skills/` | 通常没有 | `.devin/workflows/` |
| Qoder | `--qoder` | `.qoder/` | `.qoder/skills/` | `.qoder/agents/` | `.qoder/hooks/` + `.qoder/settings.json` |
| CodeBuddy | `--codebuddy` | `.codebuddy/` | `.codebuddy/skills/` | `.codebuddy/agents/` | `.codebuddy/hooks/` + `.codebuddy/settings.json` |
| GitHub Copilot | `--copilot` | `.github/` | `.github/skills/` | `.github/agents/` | `.github/copilot/hooks/` + prompts |
| Factory Droid | `--droid` | `.factory/` | `.factory/skills/` | `.factory/droids/` | `.factory/hooks/` + 设置 |
| Pi Agent | `--pi` | `.pi/` | `.agents/skills/` | `.pi/agents/` | `.pi/extensions/trellis/`（原生 `trellis_subagent` tool）+ `.pi/settings.json` |
| Trae IDE | `--trae` | `.trae/` | `.trae/skills/` | `.trae/agents/` | `.trae/hooks/` + `.trae/hooks.json` |
| Reasonix | `--reasonix` | `.reasonix/` | `.reasonix/skills/` | 无——sub-agent 是带 `runAs: subagent` frontmatter 的 Skill | 无 |
| ZCode | `--zcode` | `.zcode/` | `.zcode/skills/` | `.zcode/agents/` | `.zcode/hooks/` + `.zcode/config.json` |
| Grok Build | `--grok` | `.grok/` | `.grok/skills/` | `.grok/agents/` | 基于拉取的 prelude |
| Kimi Code | `--kimi` | `.kimi-code/` | `.agents/skills/` + `.kimi-code/skills/` | 无——Agent prompt 作为 Skill 派发给内置 `coder` | 无 |
| Snow CLI | `--snow` | `.snow/` | `.snow/skills/` | `.snow/agents/` | class-1 Hook + `.snow/hooks/` |

## 能力组

### Trellis 子代理支持

这些平台通常具有 `trellis-research`、`trellis-implement` 和 `trellis-check` 文件：

- Claude Code
- Cursor
- OpenCode
- Codex
- Kiro
- Gemini CLI
- Qoder
- CodeBuddy
- GitHub Copilot
- Factory Droid
- Pi代理

当更改实现/检查/研究行为时，首先查找相应的平台 agent 文件。

### 主会议工作流程平台

这些平台更多地依赖工作流程/skills来指导主要会话：

- 公斤
- Antigravity
- Windsurf

更改行为时，请首先检查工作流程和 skills。不要假设 Trellis 子 agents 存在。

### 共享 `.agents/skills/`

Codex 写入共享 `.agents/skills/` 层。一些支持agentskills.io的工具也可以读取该目录。如果用户希望多个兼容工具共享一个 skill，请首先考虑 `.agents/skills/`，但不要假设每个平台都会读取它。

## 修改平台文件时的决策规则

1. 用户指定平台：仅修改该平台目录，除非共享 workflow/spec 文件也必须更改。
2. 用户说“所有平台都应该这样做”：逐个平台同步等效入口点；不要只修改一个目录。
3. 用户只说“我的AI”：检查项目中实际存在的配置目录并推断当前的AI平台。
4. 用户想要项目规则：更喜欢 `.trellis/spec/` 或项目本地 skill。
5. 用户想要Trellis行为：编辑`.trellis/workflow.md`加上平台hooks/agents/skills/commands。

## 当路径不同时

平台生态系统发生变化，用户项目可能已经被定制。如果此表与本地文件不一致，请使用用户项目中的实际设置/配置作为权威：

- 检查设置寄存器的hook。
- 检查 command/prompt/workflow 指向的脚本。
- 通过当前写入 agent 文件中的读取规则来判断行为。

不要仅仅因为自定义文件未在此路径表中列出而将其删除。

### `.omp/` — Oh My Pi（OMP）

这是扩展驱动的平台。OMP 原生 provider 会自动发现所有子目录。

```text
.omp/
├── commands/          # Slash command（扁平 .md）
├── skills/            # 自动触发的 Skill（每个目录一个 SKILL.md）
├── agents/            # Agent 定义（.md）
└── extensions/
    └── trellis/
        └── index.ts   # Trellis 扩展（Context 注入）
```

没有 `settings.json`——OMP 会自动扫描 `.omp/` 子目录。
没有 Python Hook——等价行为位于 TypeScript 扩展中。

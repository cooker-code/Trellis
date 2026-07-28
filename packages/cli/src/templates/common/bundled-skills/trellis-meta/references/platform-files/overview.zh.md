# 平台文件概述

Trellis 将相同的本地架构连接到不同的 AI 工具。 `.trellis/` 存储共享的 runtime；平台目录存储定义每个 AI 工具如何进入 Trellis 的适配器文件。

当本地 AI 修改 Trellis 时，它应该首先区分两个文件类别：

- **共享文件**：`.trellis/workflow.md`、`.trellis/tasks/`、`.trellis/spec/`、`.trellis/scripts/`。
- **平台文件**：`.claude/`、`.codex/`、`.cursor/`、`.opencode/`、`.kiro/`、`.gemini/`、`.qoder/`、 `.codebuddy/`、`.github/`、`.factory/`、`.pi/`、`.kilocode/`、`.agent/`、`.windsurf/` 和类似目录。

平台文件不存储业务状态。他们让相应的AI工具读取Trellis状态，调用Trellis脚本，并加载Trellis skills/agents/hooks。

## 平台文件类别

| 类别 | 常用路径 | 目的 |
| --- | --- | --- |
| 设置/配置 | `.claude/settings.json`、`.codex/hooks.json`、`.qoder/settings.json` | 注册 hooks、插件、扩展或平台行为。 |
| hooks/插件/扩展 | `.claude/hooks/`、`.opencode/plugins/`、`.pi/extensions/` | 在会话启动、用户输入、agent 启动、shell 执行和类似事件时注入上下文。 |
| agents | `.claude/agents/`、`.codex/agents/`、`.kiro/agents/` | 定义 `trellis-research`、`trellis-implement` 和 `trellis-check`。 |
| skills | `.claude/skills/`、`.agents/skills/`、`.qoder/skills/` | 自动触发或可按需阅读的功能描述。 |
| commands/prompts/工作流程 | `.cursor/commands/`、`.github/prompts/`、`.windsurf/workflows/` | 由用户显式调用的入口点。 |

## 三种平台集成模式

### 1. 挂钩/延伸驱动

这些平台可以在特定事件上触发脚本或插件，并主动将 Trellis 上下文注入 AI 中。

共同能力：

- 会话开始注入 `.trellis/` 概述。
- workflow-每个用户回合的状态提示。
- PRD/spec/子agents启动时研究注入。
- Shell commands 继承会话身份。

要更改“当 AI 知道什么时”，请首先检查 hooks/plugins/extensions 和设置。

### 2. 代理前奏/基于拉动

某些平台无法可靠地让 hooks 重写子agent prompts，因此 agent 文件本身指示 agent 读取活动的 task、PRD 和JSONL 启动后的上下文。

要更改 sub-agents 加载上下文的方式，请检查 agent 文件本身。

### 3. 主会议工作流程

某些平台没有 Trellis 子 agent 或 hook 功能。他们依靠工作流程/skills/commands来引导主会话AI读取文件、运行脚本并向前移动tasks。

要更改行为，请检查平台工作流程/skills/commands 和 `.trellis/workflow.md`。

## 本地修改令

当用户要求自定义平台行为时，AI 应按以下顺序检查文件：

1. 读取 `.trellis/workflow.md` 以确认共享流。
2. 读取目标平台的设置/配置以查看注册了哪些 hooks/agents/skills/commands 。
3. 读取目标平台的agents/skills/commands/hooks。
4. 修改最接近用户需要的本地文件。
5. 如果更改影响共享流，请同步 `.trellis/workflow.md` 或 `.trellis/spec/`。

不要只修改平台文件而忘记共享的 workflow。不要仅修改 `.trellis/workflow.md` 并忘记平台入口点可能仍包含旧的描述。

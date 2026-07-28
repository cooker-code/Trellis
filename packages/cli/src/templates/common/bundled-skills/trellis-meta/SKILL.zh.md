---
name: trellis-meta
description: "了解并自定义用户项目内的本地 Trellis 架构。在修改 .trellis 及平台 hooks、设置、agents、skills、commands、prompts，或由 trellis init 生成的 workflows 时使用。"
---

# Trellis Meta

此 skill 适用于已在项目中运行 `trellis init` 的本地 Trellis 用户。阅读完后，AI 应该了解该用户项目内的 Trellis 架构、运作模型和自定义入口点，然后根据用户的请求修改生成的 `.trellis/` 和平台目录文件。

默认操作范围是用户项目中的本地文件：

- `.trellis/`：workflow、配置、tasks、spec、工作区、脚本和 runtime 状态。
- 平台目录：`.claude/`、`.codex/`、`.cursor/`、`.opencode/`、`.kiro/`、`.gemini/`、`.qoder/`、 `.codebuddy/`、`.github/`、`.factory/`、`.pi/`、`.kilocode/`、`.agent/`、`.windsurf/` 和类似目录。
- 共享 skill 层：`.agents/skills/`。

不要假设用户拥有 Trellis 源存储库。不要默认修改全局 npm 安装目录或 `node_modules`。

## 如何使用

1. 首先读取`references/local-architecture/overview.md`来建立本地Trellis系统模型。
2. 如果请求涉及特定的 AI 工具，请阅读 `references/platform-files/platform-map.md` 和相关平台文件说明。
3. 如果用户想要更改行为，请阅读 `references/customize-local/overview.md`，然后打开特定的自定义主题。
4. 在编辑之前，请读取用户项目中的实际文件，并将本地内容视为权威内容。

## 参考

### 本地架构

- `references/local-architecture/overview.md`：三层本地Trellis架构和定制原则。
- `references/local-architecture/generated-files.md`：由 `trellis init` 生成的文件及其自定义边界。
- `references/local-architecture/workflow.md`：`.trellis/workflow.md` 中的阶段、路由和 workflow 状态块。
- `references/local-architecture/task-system.md`：任务目录，活动 tasks、JSONL 上下文和 task runtime。
- `references/local-architecture/spec-system.md`：`.trellis/spec/` 是如何组织和注入的。
- `references/local-architecture/workspace-memory.md`：`.trellis/workspace/`、日志和跨会话内存。
- `references/local-architecture/context-injection.md`：挂钩、子agent前奏和上下文注入路径。

### 平台文件

- `references/platform-files/overview.md`：共享的 `.trellis/` 文件如何与平台目录相关。
- `references/platform-files/platform-map.md`：skills、agents、hooks 和扩展的平台目录和路径。
- `references/platform-files/hooks-and-settings.md`：设置/配置文件、hooks、插件和扩展如何连接到 Trellis。
- `references/platform-files/agents.md`：`trellis-research`、`trellis-implement` 和 `trellis-check` 的本地文件职责。
- `references/platform-files/skills-and-commands.md`：skills、commands、prompts 和工作流程之间的差异，以及如何更改它们。

### 本地化定制

- `references/customize-local/overview.md`：为用户的请求选择正确的本地自定义入口点。
- `references/customize-local/change-workflow.md`：更改阶段、路由、下一步操作和 workflow 状态。
- `references/customize-local/change-task-lifecycle.md`：更改 task 创建、状态、存档行为和 hooks。
- `references/customize-local/change-context-loading.md`：更改 tasks、specs、日志和 hook 上下文的加载方式。
- `references/customize-local/change-hooks.md`：更改平台 hooks、设置和 shell 会话桥。
- `references/customize-local/change-agents.md`：更改研究、实施和检查 agent 行为。
- `references/customize-local/change-skills-or-commands.md`：添加或修改本地 skills、commands、prompts 和工作流程。
- `references/customize-local/change-spec-structure.md`：调整`.trellis/spec/`下的项目spec结构。
- `references/customize-local/add-project-local-conventions.md`：将团队规则放入项目本地 specs 或本地 skills 中。

## 现行规则

- `.trellis/workflow.md` 是本地 workflow 事实来源。
- `.trellis/config.yaml` 是项目级 Trellis 配置和 task hook 配置入口点。
- `.trellis/spec/` 存储用户的项目特定编码约定和设计约束。
- `.trellis/tasks/` 存储 task PRD、技术说明、研究文件和 JSONL 上下文。
- `.trellis/workspace/` 存储开发者日志和跨会话内存。
- 平台设置/配置文件决定实际运行哪些 hooks、agents、skills、commands、prompts 和工作流程。
- `.trellis/.template-hashes.json` 和 `.trellis/.runtime/` 是管理/runtime 状态文件。编辑前请确认必要性。

## 不要

- 不要将 Trellis 上游源代码视为本地自定义的默认目标。
- 不要修改全局npm安装目录或`node_modules/@mindfoldhq/trellis`来实现项目需求。
- 不要使用默认模板覆盖用户修改的本地文件。
- 不要将团队私有项目规则公开`trellis-meta`；将项目规则放入 `.trellis/spec/` 或项目本地 skill 中。
- 不要将已删除的历史机制描述为当前的 Trellis 行为。

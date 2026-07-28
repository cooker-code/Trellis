# 本地 Trellis 架构概述

`trellis-meta` 适用于已运行 `trellis init` 的用户项目。用户的机器通常只有 npm 安装的 `trellis` command 加上项目内部生成的 Trellis 文件；它可能没有 Trellis CLI 源代码。

因此，当 AI 使用此 skill 时，默认的自定义目标是用户项目内的本地文件：

- `.trellis/`：workflow、tasks、specs、内存、脚本和 runtime 状态。
- 平台目录：`.claude/`、`.codex/`、`.cursor/`、`.opencode/`、`.kiro/`、`.gemini/`、`.qoder/`、 `.codebuddy/`、`.github/`、`.factory/`、`.pi/`、`.kilocode/`、`.agent/`、`.windsurf/` 和类似目录。
- 共享 skill 层：`.agents/skills/`。

不要默认引导用户分叉 Trellis CLI 存储库。仅当用户明确表示想要更改 Trellis 上游源代码、发布 npm 包或贡献 PR 时，才将上游源代码视为操作目标。

## 本地系统模型

Trellis 在用户项目内提供三个层：

1. **工作流层**：`.trellis/workflow.md` 定义阶段、路由、下一步操作和 prompt 块。
2. **持久层**：`.trellis/tasks/`、`.trellis/spec/` 和 `.trellis/workspace/` 存储 tasks、specs 和会话内存。
3. **平台集成层**：hooks、设置、agents、skills、commands、prompts以及平台目录中的工作流程连接Trellis workflow 到不同的 AI 工具。

所有三个层都位于用户项目内，因此 AI 可以直接读取和修改它们。

## 核心路径

| 小路 | 目的 |
| --- | --- |
| `.trellis/workflow.md` | 工作流程阶段、skill 路由和 workflow 状态 prompt 块。 |
| `.trellis/config.yaml` | 项目配置、task生命周期hooks、monorepo包配置和日志配置。 |
| `.trellis/spec/` | 用户特定于项目的编码约定和思维指南。 |
| `.trellis/tasks/` | 每个 task 的 PRD、技术说明、研究文件和 JSONL 上下文。 |
| `.trellis/workspace/` | 每个开发人员的日志和跨会话内存。 |
| `.trellis/scripts/` | commands、hooks 使用的本地 Python runtime 和上下文注入。 |
| `.trellis/.runtime/` | 会话级 runtime 状态，例如当前 task 指针。 |
| `.trellis/.template-hashes.json` | Trellis 管理的文件的模板哈希值，更新使用它来确定用户是否修改了本地文件。 |

## AI 定制原则

1. **首先找到本地事实来源**：不要凭记忆进行编辑。首先读取`.trellis/workflow.md`、`.trellis/config.yaml`、相关平台目录以及相关task文件。
2. **编辑用户项目，而不是 npm 包缓存**：修改项目内生成的文件，而不是 `node_modules` 或全局 npm 安装目录。
3. **保持平台文件与 `.trellis/`** 保持一致：如果 workflow 路由更改，还要检查平台 skills 或 commands 是否仍然描述相同的流程。
4. **将项目特定规则放入 `.trellis/spec/` 或本地 skill**：不要将团队约定放入 `trellis-meta`。
5. **保留用户更改**：如果文件已在本地修改，则从当前内容开始工作，而不是使用默认模板覆盖它。

## 如何使用该目录

- 要了解初始化后存在哪些文件，请阅读 `generated-files.md`。
- 要更改阶段、路线或下一步操作，请阅读 `workflow.md`。
- 要更改 task 模型、JSONL 上下文或活动 task 行为，请阅读 `task-system.md`。
- 要更改编码约定注入，请阅读 `spec-system.md`。
- 要了解日志和跨会话内存，请阅读 `workspace-memory.md`。
- 要更改 hooks 或子 agent 上下文加载，请阅读 `context-injection.md`。

# Init后生成的本地文件

`trellis init` 将 Trellis runtime 写入用户项目。随后，`trellis update` 尝试更新 Trellis 管理的模板文件，但它使用 `.trellis/.template-hashes.json` 来确定哪些文件已被用户修改。

此页面仅描述用户项目内可见和可编辑的文件。

## `.trellis/`

```text
.trellis/
├── workflow.md
├── config.yaml
├── .developer
├── .version
├── .template-hashes.json
├── .runtime/
├── scripts/
├── spec/
├── tasks/
└── workspace/
```

| 小路 | 通常可以编辑吗？ | 笔记 |
| --- | --- | --- |
| `.trellis/workflow.md` | 是的 | 本地 workflow 文档和 AI 路由规则。 |
| `.trellis/config.yaml` | 是的 | 项目配置、hooks、包、日志行限制和相关设置。 |
| `.trellis/spec/` | 是的 | 项目 specs，旨在由用户和 AI 定期更新。 |
| `.trellis/tasks/` | 是 | task 材料和研究产物，由 task workflow 维护。 |
| `.trellis/workspace/` | 是的 | 会话记录，通常由`add_session.py`写入。 |
| `.trellis/scripts/` | 小心 | 本地 runtime。它可以定制，但只有在了解调用链之后才能定制。 |
| `.trellis/.runtime/` | 不 | 运行时状态，通常由 hooks/scripts 自动写入。 |
| `.trellis/.developer` | 小心 | 当前的开发者身份。 |
| `.trellis/.version` | 不 | Trellis 更新/迁移逻辑使用的版本记录。 |
| `.trellis/.template-hashes.json` | 不 | 模板哈希记录。不要在这里手写业务规则。 |

## 平台目录

不同的平台生成不同的目录。常见类别：

| 类别 | 示例路径 | 目的 |
| --- | --- | --- |
| hooks | `.claude/hooks/`、`.codex/hooks/`、`.cursor/hooks/` | 注入会话上下文、workflow 状态和子agent 上下文。 |
| 设置 | `.claude/settings.json`、`.codex/hooks.json`、`.qoder/settings.json` | 告诉平台何时运行 hooks 或插件。 |
| agents | `.claude/agents/`、`.codex/agents/`、`.kiro/agents/` | 定义 agents，例如 `trellis-research`、`trellis-implement` 和 `trellis-check`。 |
| skills | `.claude/skills/`、`.agents/skills/`、`.qoder/skills/` | 自动触发或可由 AI 读取的技能。 |
| commands/prompts/工作流程 | `.cursor/commands/`、`.github/prompts/`、`.windsurf/workflows/` | 显式用户调用的 command 或 workflow 入口点。 |

修改平台目录时，还要确认 `.trellis/workflow.md` 是否仍然描述相同的流程。

## 模板哈希的含义

`.trellis/.template-hashes.json` 记录上次 Trellis 写入模板文件时的内容哈希。 `trellis update` 用它来区分三种情况：

| 案件 | 更新行为 |
| --- | --- |
| 文件未被用户修改 | 它可以自动更新。 |
| 文件已被用户修改 | 提示用户覆盖、保留或生成 `.new`。 |
| 文件不再是当前模板 | 根据迁移规则，它可以被删除、重命名或保留。 |

当 AI 自定义本地 Trellis 文件时，不需要手动维护哈希值。 Trellis update 将结果识别为“由用户修改”是正常的。

## 本地定制边界

默认可编辑：

- `.trellis/workflow.md`
- `.trellis/config.yaml`
- `.trellis/spec/**`
- `.trellis/scripts/**`
- 平台 hooks、设置、agents、skills、commands、prompts 和工作流程

默认不编辑：

- 全局 npm 安装目录
- `node_modules/@mindfoldhq/trellis`
- Trellis GitHub 存储库源代码
- `.trellis/.runtime/**` 下的具体状态文件
- `.trellis/.template-hashes.json` 内的哈希内容

仅当用户明确希望向上游做出贡献时，才切换到 Trellis CLI 源代码视角。

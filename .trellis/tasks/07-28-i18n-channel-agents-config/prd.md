# 汉化 Channel Agents 与配置说明

## 目标

补全 Trellis 的中文模板覆盖：当目标项目配置 `language: zh` 或命令显式传入 `--language zh` 时，`.trellis/agents/implement.md`、`.trellis/agents/check.md` 与 `.trellis/config.yaml` 均落地为中文；英文默认行为和既有落地路径保持不变。

## 已确认事实

- `.trellis/agents/` 是 `trellis channel spawn --agent <name>` 读取的 Channel 运行时 Agent 卡片，由 `packages/cli/src/templates/trellis/agents/*.md` 提供。
- 当前只有英文 `implement.md` 和 `check.md`，模板入口的 `getAllAgents()` 不接受语言参数，因此 `language: zh` 无法影响该目录。
- `workflow.md` 已通过 `getWorkflowTemplate(language)` 使用 `*.zh.md` 后缀选择并以无后缀路径落地；此任务应复用同一约定。
- `config.yaml` 当前只有英文模板，并且 `trellis update --force` 会覆盖项目写入的 `language: zh`，需要中文模板在中文初始化或更新时显式落地该设置。
- 模板哈希以目标落地路径和落地内容为准；语言后缀不得出现在目标路径或 `.template-hashes.json` 键中。

## 范围

### 包含

- 新增 `check.zh.md`、`implement.zh.md`，翻译面向人类与 LLM 的自然语言，保留命令、路径、YAML 字段、状态值和代码标识符。
- 新增 `config.zh.yaml`，提供完整中文说明，并在中文模式下写入有效的 `language: zh`。
- 扩展模板聚合和 `trellis init` / `trellis update` 的语言选择，使其在中英两种语言下对 Agent 和配置文件都使用正确源文件。
- 补充单元与集成测试，覆盖中文落地、英文回归、无后缀目标路径、模板哈希与更新路径。

### 不包含

- CLI 命令帮助、交互提示和错误文案的中文化。
- `.trellis/spec/`、`.trellis/tasks/`、`.trellis/workspace/` 等用户数据目录的重写。
- 新增第三种语言或更改 Channel 的运行时协议。

## 验收标准

- [ ] `getAllAgents("zh")` 返回中文 Agent 内容，`getAllAgents("en")` 保持当前英文内容；缺失翻译时回退英文。
- [ ] `trellis init --language zh` 和 `trellis update --language zh` 在目标项目落地中文 `.trellis/agents/check.md`、`.trellis/agents/implement.md` 与 `.trellis/config.yaml`；不生成 `.zh.*` 目标文件。
- [ ] 中文 `.trellis/config.yaml` 包含完整中文说明和有效的 `language: zh`，后续无 flag 的 `trellis update` 仍保持中文。
- [ ] 默认英文初始化、更新及模板哈希行为不变。
- [ ] 相关测试、`pnpm lint`、`pnpm typecheck` 通过。

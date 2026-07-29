# 设计：Channel Agent 与配置模板中文化

## 模板选择契约

英文源文件保留不变；中文翻译采用并列后缀：

```text
agents/check.md       -> agents/check.zh.md
agents/implement.md   -> agents/implement.zh.md
config.yaml           -> config.zh.yaml
```

模板聚合层接收已解析的 `language`，优先选择 `*.zh.*`，不存在时回退英文源。输出 Map 的键始终为 `check.md`、`implement.md` 和 `config.yaml`，从而维持用户项目路径与模板哈希契约。

## 代码边界

- `packages/cli/src/templates/trellis/index.ts`：提供按语言读取的 Agent 集合与配置模板选择器；复用 `workflow.md` 的懒加载、缓存和英文回退模式，避免每种模板各自实现解析逻辑。
- `packages/cli/src/commands/init.ts`：向 Agent 和配置模板聚合传递已解析语言。
- `packages/cli/src/commands/update.ts`：向 Agent 和配置模板聚合传递已解析语言，随后继续通过既有 `preserveExistingRegistryConfig` 保留 registry 段。
- `packages/cli/src/templates/trellis/`：新增三份中文源模板，不改变英文源文件。

## 持久化与兼容性

中文 `config.zh.yaml` 的生效行写为 `language: zh`。因此在 `init --language zh` 或 `update --language zh --force` 后，后续未带 flag 的操作仍解析为中文。英文模板继续保留注释形式的 `# language: en`，默认回退英文。

当用户修改 `.trellis/config.yaml` 时，既有冲突提示和 `--force` 语义不变；本任务不改变用户数据目录保护规则。

## 测试策略

1. 模板单元测试：断言中英 Agent 与 config 选择、无后缀 Map 键及缺失翻译回退。
2. 初始化集成测试：中文安装后比较 Agent/config 的落地内容和哈希；英文默认结果维持既有断言。
3. 更新集成测试：切换至中文后更新 Agent/config，确认路径不带后缀、哈希对应中文内容且下一次更新从 `language: zh` 持续选择中文。
4. 回归：运行 CLI 包测试、lint、typecheck。

## 风险与回滚

风险在于 `config.yaml` 是用户可编辑文件；通过现有修改检测、备份和冲突决策保护。若出现回归，移除新增中文源并恢复聚合器对英文常量的调用，即可恢复原行为；不需要迁移或修改用户 Task。

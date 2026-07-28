# 规范写作

Trellis specs 是未来 agents 的编码指南。他们应该解释如何在这个存储库中工作，而不是如何组织通用项目。

## 从证据中写作

每条重要规则都应得到以下其中一项的支持：

- 演示首选模式的源文件。
- 显示预期行为的测试文件。
- 定义约定的项目文档。
- 跨多个文件的重复模式。

仅当简短片段使规则更清晰时才使用它们。最好链接到文件路径并命名符号或行为。

## 文件结构

保持 spec 树与项目对齐：

- 保留 `index.md` 作为 spec 目录的导航文件。
- 当开发人员独立寻找主题时，拆分主题。
- 当单独的文件重复相同的规则时合并主题。
- 删除不适用的模板文件。
- 为模板错过的重要本地模式添加新文件。

## 内容标准

好的 spec 部分包括：

- 当规则适用时。
- 应遵循的本地模式。
- 证明该模式的源文件或测试文件。
- 常见错误或反模式。
- 验证 commands 或检查它们是否具体且可靠。

避免：

- 占位散文。
- 通用框架建议。
- 仅适用于一台 agent 主机的工具指令。
- 长复制的代码块。
- 基于单个偶然实施细节的规则。

## 形状示例

```markdown
## Command Handlers

Command handlers should keep argument parsing, validation, and side effects separate. The local pattern is:

- Parse CLI flags at the command boundary.
- Convert raw inputs into typed task options before invoking core logic.
- Keep filesystem writes in the command or service layer, not in template helpers.

Reference files:
- `packages/cli/src/commands/example.ts`
- `packages/cli/test/commands/example.test.ts`

Avoid passing raw `process.argv` or unvalidated config objects into shared helpers.
```

## 最终通过

完成之前：

```bash
grep -R "To be filled\\|TODO: fill\\|placeholder" .trellis/spec
```

还要检查链接、索引文件以及是否有 spec 仍然描述模板而不是此存储库。

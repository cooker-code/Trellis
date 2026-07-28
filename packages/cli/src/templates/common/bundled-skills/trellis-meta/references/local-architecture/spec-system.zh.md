# 本地规格系统

`.trellis/spec/` 是用户项目特定的工程spec 库。 Trellis 并不是让 AI 记住约定；它注入相关的 specs 或需要 AI 在正确的时间读取它们。

## 目录模型

常见的单一存储库结构：

```text
.trellis/spec/
├── backend/
│   ├── index.md
│   └── ...
├── frontend/
│   ├── index.md
│   └── ...
└── guides/
    ├── index.md
    └── ...
```

常见的 monorepo 结构：

```text
.trellis/spec/
├── cli/
│   ├── backend/
│   │   ├── index.md
│   │   └── ...
│   └── unit-test/
│       ├── index.md
│       └── ...
├── docs-site/
│   └── docs/
│       ├── index.md
│       └── ...
└── guides/
    ├── index.md
    └── ...
```

`index.md` 是每层的入口点。它应该列出开发前检查表和质量检查。具体指南位于同一目录中的其他 Markdown 文件中。

## 封装配置

`.trellis/config.yaml` 可以声明包：

```yaml
packages:
  cli:
    path: packages/cli
  docs-site:
    path: docs-site
    type: submodule
default_package: cli
```

AI 可以运行：

```bash
python3 ./.trellis/scripts/get_context.py --mode packages
```

此 command 列出了当前项目的包和 spec 层。配置上下文 JSONL 时，请使用此输出作为参考。

## 规格如何输入任务

在 task 进入实施之前，当 task 需要 spec 或超出 task 的研究背景时，规划可能会将相关 specs 写入 `implement.jsonl` / `check.jsonl` 中文物：

```jsonl
{"file": ".trellis/spec/cli/backend/index.md", "reason": "CLI backend conventions"}
{"file": ".trellis/spec/cli/unit-test/conventions.md", "reason": "Test expectations"}
```

子agents或平台前奏读取这些JSONL文件并加载引用的specs。在不支持子agent的平台上，AI应根据workflow直接读取相关的specs。

## 规格应包含哪些内容

规范应包含项目的可执行工程约定，而不是通用的最佳实践：

- 文件应该存放的地方。
- 应如何表达错误处理。
- API、hooks 和 commands 的输入/输出合约。
- 禁止的图案。
- 需要测试的情况。
- 项目特定的陷阱以及如何避免它们。

当 AI 在实现或调试过程中学习到新规则时，它应该更新 `.trellis/spec/` 而不是仅仅在聊天中总结它。

## 本地定制点

| 需要 | 编辑位置 |
| --- | --- |
| 添加新的 spec 层 | `.trellis/spec/<package>/<layer>/index.md` 和相应的指南文件。 |
| 更改 monorepo spec 映射 | `packages` / `default_package` / `spec_scope` 在 `.trellis/config.yaml` 中。 |
| 更改 specs AI 在实施前读取的内容 | task 的 `implement.jsonl`。 |
| 更改检查期间读取的 specs AI | task 的 `check.jsonl`。 |
| 更改 specs 应更新的时间 | `.trellis/workflow.md` 和 `trellis-update-spec` skill 中的阶段 3.3。 |

## 边界

`.trellis/spec/` 是用户的项目规范，而不是 Trellis 内置模板的永久副本。 AI 应鼓励用户根据实际项目代码进行更新，而不是将 Trellis 默认模板视为不可变文档。

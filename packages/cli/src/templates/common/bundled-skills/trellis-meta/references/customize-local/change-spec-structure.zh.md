# 更改本地规格结构

当用户想要更改后面的工程约定 AI 、添加新的 spec 层或调整 monorepo 包映射时，请编辑 `.trellis/spec/` 和 `.trellis/config.yaml` 。

## 首先阅读这些文件

1. `.trellis/config.yaml`
2. `.trellis/spec/`
3. `.trellis/workflow.md` 规划产物指南和阶段 3.3
4. 当前 task `implement.jsonl` / `check.jsonl`

## 常见需求

| 需要 | 编辑位置 |
| --- | --- |
| 添加 backend/frontend/docs/test spec 层 | `.trellis/spec/<layer>/` 或 `.trellis/spec/<package>/<layer>/` |
| 添加共享思维指南 | `.trellis/spec/guides/` |
| 调整 monorepo 包 | `packages` 在 `.trellis/config.yaml` 中 |
| 更改默认包 | `default_package` 在 `.trellis/config.yaml` 中 |
| 控制spec扫描范围 | `spec_scope` 在 `.trellis/config.yaml` 中 |
| 让 task 读取新的 spec | 任务 `implement.jsonl` / `check.jsonl` |

## 添加规格层

单一存储库示例：

```text
.trellis/spec/security/
├── index.md
└── auth.md
```

Monorepo 示例：

```text
.trellis/spec/webapp/security/
├── index.md
└── auth.md
```

`index.md` 应包括：

- 该层适用于什么代码。
- 开发前检查表。
- 质量检查。
- 特定指南文件的链接。

## 更新上下文

添加 spec 并不意味着每个 task 都会自动读取它。当前的 task 必须在 JSONL 中引用它：

```bash
python3 ./.trellis/scripts/task.py add-context <task> implement ".trellis/spec/webapp/security/index.md" "Security conventions"
python3 ./.trellis/scripts/task.py add-context <task> check ".trellis/spec/webapp/security/index.md" "Security review rules"
```

## 更改 Monorepo 包

示例 `.trellis/config.yaml`：

```yaml
packages:
  webapp:
    path: apps/web
  api:
    path: apps/api
default_package: webapp
```

编辑完成后，运行：

```bash
python3 ./.trellis/scripts/get_context.py --mode packages
```

使用此输出确认 AI 可以看到正确的包和 spec 层。

## 笔记

- 规格是用户项目惯例，可以根据项目需要进行更改。
- 不要将临时的task信息放入specs中；将临时信息放入 task 中。
- 不要仅将长期约定放在 agents 或 commands 中；将它们保存在 specs 中。
- 更改 spec 结构后，检查现有 task JSONL 文件是否仍然指向存在的文件。

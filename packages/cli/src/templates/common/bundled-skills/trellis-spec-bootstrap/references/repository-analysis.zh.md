# 存储库分析

目标是在编写规则之前发现项目的真实架构。不要从通用 spec 模板开始并填充空白。从代码开始，然后是 spec 结构。

## 分析顺序

1. 阅读现有的 `.trellis/spec/` 树并注意哪些文件是模板、过时的或已经是特定于项目的。
2. 检查包清单、构建脚本、工作区配置和顶级文档以识别包和 runtime 层。
3. 将 GitNexus 用于执行流、模块集群、依赖中心和影响敏感区域。
4. 使用 ABCoder 或语言本机工具来获取精确的签名、类型、类边界和实现示例。
5. 在将任何发现转化为 spec 规则之前，请直接阅读代表性源文件和测试文件。

## 捕捉什么

| 区域 | 问题 |
|------|-----------|
| 包边界 | 每个包都有什么？什么东西跨境进口？ |
| 运行时层 | 哪个代码是 CLI、后端、前端、工作者、共享库、仅测试或工具？ |
| 核心抽象 | 哪些类型、服务、存储、commands、路由或适配器定义了系统形状？ |
| 数据流 | 用户输入在哪里输入、如何验证以及状态在哪里保留？ |
| 错误处理 | 如何表示、记录、呈现和测试故障？ |
| 配置 | 默认值、环境配置、生成的文件和模板位于哪里？ |
| 测试 | 哪些测试风格是新工作值得信赖的示例？ |

## GitNexus 用法

从广泛开始，然后检查特定符号：

```text
gitnexus_query({query: "CLI command execution flow"})
gitnexus_query({query: "template generation and migration"})
gitnexus_context({name: "SymbolName"})
gitnexus_cypher({query: "MATCH (n)-[r]->(m) RETURN n.name, type(r), m.name LIMIT 30"})
```

使用 GitNexus 结果查找重要文件和流。在检查相关源文件之前，请勿将图表输出作为最终权威引用。

## ABCoder 用法

当 spec 需要精确的代码形状时，请使用 ABCoder：

```text
list_repos()
get_repo_structure({repo_name: "package-name"})
get_file_structure({repo_name: "package-name", file_path: "src/example.ts"})
get_ast_node({repo_name: "package-name", node_ids: [{mod_path: "...", pkg_path: "...", name: "SymbolName"}]})
```

ABCoder 对于记录构造函数模式、函数签名、类型契约和引用链最有价值。

## 分析笔记

分析时记下简短的笔记。注释应包括：

- 包或层名称。
- 定义本地模式的文件。
- spec 应教授的规则。
- 在旧代码、注释、测试或迁移路径中发现的反模式。
- 应创建、删除、重命名或合并的规范文件。

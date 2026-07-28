# MCP 设置

在引导 Trellis specs 时，建议使用 GitNexus 和 ABCoder，因为它们将架构和 AST 上下文公开给 agent。它们是工具选择，而不是平台要求。通过 agent 主机提供的任何 MCP 机制配置它们。

## GitNexus

GitNexus 从存储库构建代码知识图。将其用于模块边界、执行流、依赖关系、影响范围和图查询。

### 安装和索引

```bash
# Run from the repository root.
npx gitnexus analyze

# Check index status.
npx gitnexus status

# Re-index after code changes when the analysis is stale.
npx gitnexus analyze
```

索引写入 `.gitnexus/`。仅当项目已使用嵌入时才保留嵌入；否则，普通索引足以进行 spec 引导。

### MCP 服务器命令

在主机的 MCP 配置中使用此服务器 command ：

```bash
npx -y gitnexus mcp
```

### 有用的工具

| 工具 | 目的 |
|------|---------|
| `gitnexus_query` | 按概念查找执行流程和功能区域 |
| `gitnexus_context` | 检查符号的调用者、被调用者、引用和进程参与 |
| `gitnexus_impact` | 更改符号前了解影响范围 |
| `gitnexus_detect_changes` | 完成之前检查更改的符号和受影响的流程 |
| `gitnexus_cypher` | 运行直接图形查询 |
| `gitnexus_list_repos` | 列出索引存储库 |

## ABCoder

ABCoder 将代码解析为 UniAST，并给出精确的包、文件和节点级结构。将其用于签名、类型形状、实现、依赖项和反向引用。

### 安装

```bash
go install github.com/cloudwego/abcoder@latest
abcoder --help
```

### 解析存储库

```bash
abcoder parse /absolute/path/to/package \
  --lang typescript \
  --name package-name \
  --output ~/abcoder-asts
```

对于 monorepos，使用稳定的 `--name` 解析每个包，以便 task 注释可以引用相同的存储库名称。

### MCP 服务器命令

在主机的 MCP 配置中使用此服务器 command ：

```bash
abcoder mcp ~/abcoder-asts
```

### 有用的工具

| 工具 | 层 | 目的 |
|------|-------|---------|
| `list_repos` | 1 | 列出已解析的存储库 |
| `get_repo_structure` | 2 | 检查包和文件 |
| `get_package_structure` | 3 | 检查包内的节点 |
| `get_file_structure` | 3 | 检查文件中的函数、类、类型和签名 |
| `get_ast_node` | 4 | 检索代码、依赖项、引用和实现 |

## 确认

配置后，从 agent 主机验证两个 MCP 服务器是否可见。然后在开始 spec 写入过程之前对每台服务器运行一个简单的查询。

```bash
ls .gitnexus/meta.json
ls ~/abcoder-asts/*.json
```

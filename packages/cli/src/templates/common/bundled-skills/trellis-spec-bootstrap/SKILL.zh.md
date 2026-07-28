---
name: trellis-spec-bootstrap
description: "使用平台中立的单 agent workflow 引导项目特定的 Trellis 编码 specs。在创建或刷新 .trellis/spec 指南、通过 GitNexus、ABCoder 或源码检查分析代码库、分解包/层 spec 工作，并编写真正由代码库支撑且没有占位文本的 spec 文档时使用。"
---

# Trellis Spec Bootstarp

使用此 skill 从真实代码库创建或刷新 `.trellis/spec/` 指南。一个有能力的 agent 拥有完整的循环：分析存储库、选择 spec 边界、编写文档并验证结果。 workflow 不依赖于特定主机、CLI 或 agent 品牌。

## 工作流程

1. 确认 Trellis 已初始化并检查当前 `.trellis/spec/` 树。
2. 使用最佳可用工具分析存储库架构：GitNexus、ABCoder、语言工具和直接源读取。
3. 仅当反映实际代码库时，才按包和层分解 spec 工作。
4. 使用项目中的具体模式、文件路径、示例和反模式填充或重塑 spec 文件。
5. 验证最终的 specs 内部一致并且不包含模板占位符。

## 参考路由

| 需求 | 参考资料 |
|------|------|
| 存储库架构分析 | [参考资料/repository-analysis.md](references/repository-analysis.md) |
| 规范工作分解和 task 规划 | [参考资料/spec-task-planning.md](references/spec-task-planning.md) |
| 写入高信号 Trellis spec 文件 | [参考资料/spec-writing.md](references/spec-writing.md) |
| GitNexus 和 ABCoder MCP 设置 | [参考资料/mcp-setup.md](references/mcp-setup.md) |

## 操作规则

- 将模板视为起点，而不是合同。当存储库需要时，删除、重命名、拆分或添加 spec 文件。
- 与一般建议相比，更喜欢来源支持的规则。每个重要的建议都应该指向真实的文件或重复的本地模式。
- 默认由单一主体负责执行。可选辅助 agents 属于实现细节，不是必需条件，也不是用户可见的依赖。
- 除非目标项目已经在该平台上标准化，否则不要编写特定于平台的指令。
- 不要在 `.trellis/spec/` 中留下占位符文本、空标题或复制的样板文件。

## 完成标准

- `.trellis/spec/` 描述了当前存在的项目。
- 每个相关的包或层都有实用的编码指南和真实的示例。
- 不适用的模板部分将被删除。
- `index.md` 文件与最终 spec 文件集匹配。
- 任何所需的设置或分析假设都记录在相关的 spec 或 task 注释中。

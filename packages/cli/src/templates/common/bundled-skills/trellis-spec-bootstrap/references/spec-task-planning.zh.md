# 规范任务规划

使用单个 agent 作为默认执行模型。 agent 可以创建 Trellis tasks 以实现可追溯性，但 skill 不应需要特定平台、CLI 或并行工作线程模型。

## 分解

围绕实际所有权边界创建 spec 工作单元：

- 当一个包有自己的约定时，就称为一个包。
- 当同一包具有不同的前端、后端、CLI、worker 或共享库规则时为一层。
- 当模式跨越封装并且不属于某一层时，提供一种横切指南。

避免人工分解。小型库通常需要一个集中的 spec 通行证，而不是多个 tasks 通行证。

## 任务形状

当 Trellis task 有用时，PRD 只保留以下固定章节；架构、源码证据、文件清单和执行步骤应分别进入 `design.md`、`research/` 或 `implement.md`：

```markdown
# Fill <package-or-layer> Trellis Specs

## Goal
Write project-specific `.trellis/spec/` guidance for <scope>.

## Requirements
- Capture the project-specific guidance contributors need.
- Keep the scope focused on this package or layer.

## User-visible Outcomes
- [ ] Specs contain concrete examples and anti-patterns from the repository.
- [ ] No placeholder text remains.
- [ ] Index files match the final spec files.
- [ ] Contributors can find and use the resulting guidance.
```

## 可选的辅助代理

如果主机支持子代理，助手可以检查独立的包或运行验证。它们是可选的。主要的 agent 仍然拥有集成和最终质量。

Helper tasks 必须具有明确的所有权：

- 只读研究 tasks 可以检查指定范围所需的任何来源。
- 写入 tasks 应该拥有不相交的 spec 目录。
- 验证 tasks 应检查占位符删除、损坏的链接和一致性。

不要在 skill 中对 helper-agent 名称、特定于供应商的 commands 或特定于平台的路由进行编码。仅将所需的工作和验收标准放入 task 中。

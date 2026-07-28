# 规范任务规划

使用单个 agent 作为默认执行模型。 agent 可以创建 Trellis tasks 以实现可追溯性，但 skill 不应需要特定平台、CLI 或并行工作线程模型。

## 分解

围绕实际所有权边界创建 spec 工作单元：

- 当一个包有自己的约定时，就称为一个包。
- 当同一包具有不同的前端、后端、CLI、worker 或共享库规则时为一层。
- 当模式跨越封装并且不属于某一层时，提供一种横切指南。

避免人工分解。小型库通常需要一个集中的 spec 通行证，而不是多个 tasks 通行证。

## 任务形状

当 Trellis task 有用时，请编写包含以下部分的简洁 PRD：

```markdown
# Fill <package-or-layer> Trellis Specs

## Goal
Write project-specific `.trellis/spec/` guidance for <scope>.

## Scope
- Spec directory:
- Source directories to inspect:
- Tests to inspect:
- Out of scope:

## Architecture Context
Summarize the concrete findings from repository analysis.

## Files To Create Or Update
- `.trellis/spec/.../index.md`
- `.trellis/spec/.../<topic>.md`

## Rules
- Adapt the spec file set to the real codebase.
- Use real source examples with file paths.
- Remove template-only sections that do not apply.
- Do not modify product source code unless the task explicitly asks for it.

## Acceptance Criteria
- [ ] Specs contain concrete examples and anti-patterns from the repository.
- [ ] No placeholder text remains.
- [ ] Index files match the final spec files.
- [ ] Claims are backed by source files, tests, or project docs.
```

## 可选的辅助代理

如果主机支持子代理，助手可以检查独立的包或运行验证。它们是可选的。主要的 agent 仍然拥有集成和最终质量。

Helper tasks 必须具有明确的所有权：

- 只读研究 tasks 可以检查指定范围所需的任何来源。
- 写入 tasks 应该拥有不相交的 spec 目录。
- 验证 tasks 应检查占位符删除、损坏的链接和一致性。

不要在 skill 中对 helper-agent 名称、特定于供应商的 commands 或特定于平台的路由进行编码。仅将所需的工作和验收标准放入 task 中。

# 添加项目本地约定

通常，用户不需要更改 Trellis 机制；他们需要本地 AI 来了解其团队的惯例。在这种情况下，首选 `.trellis/spec/` 或项目本地 skill 而不是编辑 `trellis-meta`。

## 东西放在哪里

| 内容类型 | 地点 |
| --- | --- |
| 规则代码必须遵循 | `.trellis/spec/<layer>/` |
| 跨层思维方法 | `.trellis/spec/guides/` |
| AI 针对项目特定流程的功能 | 平台本地 skill |
| 一次性 task 材料 | `.trellis/tasks/<task>/` |
| 会议总结 | `.trellis/workspace/<developer>/journal-N.md` |

## 创建项目本地技能

如果用户希望 AI 知道“这个项目如何定制 Trellis”，请创建一个本地 skill：

```text
.claude/skills/trellis-local/
└── SKILL.md
```

例子：

```md
---
name: trellis-local
description: "Project-local Trellis customizations for this repository. Use when changing this project's Trellis workflow, hooks, local agents, or team-specific conventions."
---

# Trellis Local

## Local Scope

This skill documents this repository's Trellis customizations only.

## Custom Workflow Rules

- ...

## Local Hook Changes

- ...

## Local Agent Changes

- ...
```

对于多平台项目，请将等效版本放在其他平台 skill 目录中，或者对于支持共享层的平台使用 `.agents/skills/` 。

## 写入 `.trellis/spec/`

如果内容是编码约定，则将其写入spec。示例：

```text
.trellis/spec/backend/error-handling.md
.trellis/spec/frontend/components.md
.trellis/spec/guides/cross-platform-thinking-guide.md
```

写入后，更新对应的`index.md`，这样AI就可以从入口点找到新的规则。

## 让当前任务使用新约定

写入 spec 后，将其添加到当前 task 上下文中：

```bash
python3 ./.trellis/scripts/task.py add-context <task> implement ".trellis/spec/backend/error-handling.md" "Error handling conventions"
python3 ./.trellis/scripts/task.py add-context <task> check ".trellis/spec/backend/error-handling.md" "Review error handling"
```

## 不要将项目私有规则存储在 `trellis-meta` 中

`trellis-meta` 是一个公共 skill，用于理解 Trellis 架构和本地定制入口点。将项目私有内容放入：

- `.trellis/spec/`
- 项目本地 skill
- 当前 task
- 工作空间日记

这可以防止未来对 Trellis 的内置 `trellis-meta` 的更新覆盖团队自己的约定。

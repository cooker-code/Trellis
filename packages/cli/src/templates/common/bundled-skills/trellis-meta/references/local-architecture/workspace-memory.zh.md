# 本地工作区内存系统

`.trellis/workspace/` 存储跨会话内存。它的目的是让 AI 和人类了解之前在不同窗口和不同日期发生的事情。

## 目录结构

```text
.trellis/workspace/
├── index.md
└── <developer>/
    ├── index.md
    ├── journal-1.md
    └── journal-2.md
```

| 文件 | 目的 |
| --- | --- |
| `.trellis/.developer` | 当前的开发者身份。 |
| `.trellis/workspace/index.md` | 全局工作区概述。 |
| `.trellis/workspace/<developer>/index.md` | 开发人员的会话索引。 |
| `.trellis/workspace/<developer>/journal-N.md` | 会议日记。 |

## 开发者身份

第一次运行：

```bash
python3 ./.trellis/scripts/init_developer.py <name>
```

这将创建 `.trellis/.developer` 和相应的工作空间目录。 AI 不应随意更改开发者身份；如果身份错误，首先确认当前项目是谁在使用。

## 杂志

`journal-N.md` 记录每个会话已完成或部分完成的工作。默认情况下，每个日志大约包含 2000 行；之后它会旋转到下一个文件。

用于记录会话的通用 command：

```bash
python3 ./.trellis/scripts/add_session.py \
  --title "Session title" \
  --summary "What changed" \
  --commit "abc1234"
```

还可以使用 `--no-commit` 或空提交值来记录没有提交的计划或审查工作。

## 工作区内存与任务之间的关系

| 系统 | 它存储什么 |
| --- | --- |
| `.trellis/tasks/` | 特定 task 的要求、设计、研究和说明。 |
| `.trellis/workspace/` | 跨 tasks 和会话的工作记录。 |
| `.trellis/spec/` | 工程知识作为长期惯例保存下来。 |

如果信息仅对当前 task 有用，则将其放入 task 目录中。
如果信息描述了当前会话中发生的情况，请将其放入工作区日志中。
如果以后每次编写代码时都需要遵循信息，则将其放入 spec 中。

## 本地定制点

| 需要 | 编辑位置 |
| --- | --- |
| 更改最大日记帐行数 | `max_journal_lines` 在 `.trellis/config.yaml` 中。 |
| 更改会话自动提交消息 | `session_commit_message` 在 `.trellis/config.yaml` 中。 |
| 更改会话内容格式 | `.trellis/scripts/add_session.py`。 |
| 更改工作区在上下文中的显示方式 | `.trellis/scripts/common/session_context.py`。 |

## AI 使用规则

AI 不应将工作空间视为唯一的事实来源。恢复 task 时，首先读取当前的 task，然后使用工作空间作为背景。一个task完成后，在工作空间中记录重要的流程注释；如果出现长期规则，请更新 spec。

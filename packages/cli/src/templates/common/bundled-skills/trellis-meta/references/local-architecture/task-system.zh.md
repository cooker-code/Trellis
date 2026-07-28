# 本地任务系统

Trellis task 系统完全存储在用户项目中的 `.trellis/tasks/` 下。每个 task 都是一个包含需求、上下文、研究、状态和关系信息的目录。

## 任务目录结构

```text
.trellis/tasks/
├── 04-28-example-task/
│   ├── task.json
│   ├── prd.md
│   ├── design.md
│   ├── implement.md
│   ├── implement.jsonl
│   ├── check.jsonl
│   └── research/
└── archive/
    └── 2026-04/
```

| 文件 | 目的 |
| --- | --- |
| `task.json` | 任务元数据：状态、受让人、优先级、分支、父/子 tasks 和类似字段。 |
| `prd.md` | 要求、约束和验收标准。轻量级 tasks 可能仅适用于 PRD。 |
| `design.md` | 复杂tasks的技术设计：边界、契约、数据流、兼容性、权衡。 |
| `implement.md` | 复杂 tasks 的执行计划：有序清单、验证 commands、审查门、回滚点。 |
| `implement.jsonl` | spec/研究文件列表，工具 agent 必须首先读取。 |
| `check.jsonl` | 检查 agent 必须首先读取的 spec/研究文件列表。 |
| `research/` | 研究文物。复杂的发现不应该只存在于聊天中。 |

## `task.json`

`task.json` 记录 task 状态和元数据。常见字段：

| 场地 | 意义 |
| --- | --- |
| `id` / `name` / `title` | 任务标识和标题。 |
| `status` | 状态，例如 `planning`、`in_progress`、`review` 或 `completed`。 |
| `priority` | `P0`、`P1`、`P2`、`P3`。 |
| `creator` / `assignee` | 创建者和受让人。 |
| `package` | monorepo 中的目标包；可能为空。 |
| `branch` / `base_branch` | 工作分支和PR目标分支。 |
| `children` / `parent` | 父/子 task 关系。 |
| `commit` / `pr_url` | 完成后提交和 PR 信息。 |
| `meta` | 扩展字段。 |

## 父/子任务树

父/子 task 关系用于组织工作。父 task 将相关交付物归入同一组源需求；它不是依赖调度器，也不会取代子 task 自己的规划产物。

当请求有多个可独立验证的可交付成果时，请使用父级 task。父母拥有：

- 来源要求和面向用户的范围。
- 子 tasks 的地图及其责任边界。
- 跨儿童接受标准和最终整合审查。

将子 tasks 用于可独立进行规划、实施、检查和归档的可交付成果。如果一个孩子依赖于另一个孩子，请在孩子 `prd.md` / `implement.md` 中写入该依赖关系；不要依赖树的位置来暗示排序。

创建新的孩子：

```bash
python3 ./.trellis/scripts/task.py create "<child title>" --slug <child-slug> --parent <parent-dir>
```

链接或取消链接现有的 tasks ：

```bash
python3 ./.trellis/scripts/task.py add-subtask <parent-dir> <child-dir>
python3 ./.trellis/scripts/task.py remove-subtask <parent-dir> <child-dir>
```

父级上的 `children` 是历史列表。当子项被存档时，Trellis 会将该子项名称保留在父项中，因此在完成的子项移动到 `archive/` 后，像 `[2/3 done]` 这样的进度仍然有意义。

AI 不应把阶段编号当作 task 状态。task 进度主要由 `status`、产物是否存在（`prd.md`，以及可选的 `design.md` / `implement.md`）、是否为 sub-agent 模式配置了 JSONL 上下文，以及 `workflow.md` 中的阶段说明共同决定。

## 活动任务

用户看到“当前 task”，但 Trellis 存储每个会话的活动 task 状态。

```text
.trellis/.runtime/sessions/<context-key>.json
```

`task.py start` 将 task 路径写入当前会话的 runtime 会话文件中。 `task.py current --source` 显示当前的 task 及其来源。不同的AI窗口可以指向不同的tasks，而不会互相覆盖。

如果平台或 shell 环境没有稳定的会话身份，`task.py start` 可能无法设置活动的 task。 AI 应该读取错误，检查平台 hook/session 环境，而不是回退到共享全局指针。

## JSONL 上下文

`implement.jsonl` 和 `check.jsonl` 是子 agents 首先读取的上下文清单。它们不会取代 `implement.md`； `implement.md` 是人类可读的执行计划。

格式：

```jsonl
{"file": ".trellis/spec/cli/backend/index.md", "reason": "Backend conventions"}
{"file": ".trellis/tasks/04-28-example/research/api.md", "reason": "API research"}
```

规则：

- 包括 spec 和研究文件。
- 不要包含将要修改的代码文件。
- 不要将聊天中的临时结论视为唯一的背景。
- 种子行没有 `file` 字段；他们仅使用 prompt 和 AI 来填写真实条目。

## 常用命令

```bash
python3 ./.trellis/scripts/task.py create "<title>" --slug <slug>
python3 ./.trellis/scripts/task.py start <task>
python3 ./.trellis/scripts/task.py current --source
python3 ./.trellis/scripts/task.py add-context <task> implement <file> <reason>
python3 ./.trellis/scripts/task.py validate <task>
python3 ./.trellis/scripts/task.py finish
python3 ./.trellis/scripts/task.py archive <task>
```

修改 task 系统时，AI 应优先使用脚本 commands 来维护结构。仅当脚本不能满足需要时，才直接编辑 JSON/Markdown 。

## 本地定制点

| 需要 | 编辑位置 |
| --- | --- |
| 更改默认的 task 模板 | `.trellis/scripts/common/task_store.py` 和 task 创建说明。 |
| 更改状态语义 | `.trellis/workflow.md`、workflow-状态 hook 逻辑和 task 使用约定。 |
| 添加 task 生命周期操作 | `hooks.after_*` 在 `.trellis/config.yaml` 中。 |
| 更改上下文规则 | `.trellis/workflow.md` 和相关平台 agent/hook 指令中的规划产物指南。 |
| 更改存档策略 | `.trellis/scripts/common/task_store.py` / `task_utils.py`。 |

这些是用户项目中的本地文件。不要默认编辑 Trellis CLI 源代码，除非用户想要向上游贡献。

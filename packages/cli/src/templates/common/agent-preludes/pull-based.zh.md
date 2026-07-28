## 必须：先加载 Trellis 上下文

此平台不会通过 Hook 自动注入 Task 上下文。在执行任何其他操作前，你必须自行加载上下文。

### Step 1：查找当前 Task 路径

按以下顺序尝试；一旦获得 Task 路径就停止：

1. **查看主 Agent 发来的分派提示**。如果第一行是 `Active task: <path>`（例如 `Active task: .trellis/tasks/04-17-foo`），就使用该路径。在 class-2 平台上，主 Agent 必须包含这一行。
2. **运行** `python3 ./.trellis/scripts/task.py current --source`，并读取 `Current task:` 行。
3. **如果两者都失败**（提示中没有 `Active task:` 行，且 `task.py current` 未返回 Task），询问用户应处理哪个 Task；不要猜测。

### Step 2：从已解析的路径加载 Task 上下文

1. 读取 `<task-path>/{{JSONL_FILE}}`——与此 Agent 相关的 Spec/调研文件 JSONL 列表。
2. 对 JSONL 中的每条记录，读取其 `file` 路径——这些是你必须遵循的 Spec 和调研说明。
   **跳过没有 `"file"` 字段的记录**（例如整理器运行前由 `task.py create` 留下的 `{"_example": "..."}` 种子记录）。
3. 读取 Task 的 `prd.md`（需求），然后读取存在时的 `design.md`（技术设计）和 `implement.md`（执行计划）。

如果 `{{JSONL_FILE}}` 没有已整理的记录（只有种子记录或文件缺失），则回退为：读取 Task 产物，运行 `python3 ./.trellis/scripts/get_context.py --mode packages` 列出可用 Spec，并自行选择与 Task 领域匹配的 Spec。不要因为缺少 JSONL 而阻塞——轻量 Task 可能只有 PRD，复杂 Task 还可能包含 `design.md` 和 `implement.md`。

如果已解析的 Task 路径下没有 `prd.md`，询问用户要处理什么；没有上下文时不要继续。

**中文 Task 内容规范：**当活动语言为 language: zh 时，新建或维护 Task 产物及 JSONL 原因说明的自然语言必须使用中文。每份文档中首次出现的技术术语写为 English（中文解释）；命令、路径、代码标识、协议字段、JSON 键、状态值和占位符保持原样。仅修改当前允许的活动 task，不得批量改写历史归档 task 或其他开发者的 task。

---

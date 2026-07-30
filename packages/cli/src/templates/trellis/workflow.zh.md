# 开发工作流

---

## 核心原则

1. **先规划，再编码** — 开始之前先弄清楚要做什么
2. **Spec 靠注入，不靠记忆** — 通过 hook/skill 注入规范，而不是凭记忆回想
3. **一切持久化** — 研究、决策和经验都写入文件；对话会被压缩，文件不会
4. **增量开发** — 一次只处理一个 Task
5. **沉淀经验** — 每个 Task 结束后回顾，并把新知识写回 Spec

---

## Trellis 系统

### 开发者身份

首次使用时，初始化你的身份：

```bash
python3 ./.trellis/scripts/init_developer.py <your-name>
```

该命令会创建 `.trellis/.developer`（gitignored）和 `.trellis/workspace/<your-name>/`。

### Spec 系统

`.trellis/spec/` 存放按 package 和 layer 组织的编码规范。

- `.trellis/spec/<package>/<layer>/index.md` — 入口，包含 **开发前检查清单** 和 **质量检查**。具体规范位于它所指向的 `.md` 文件中。
- `.trellis/spec/guides/index.md` — 跨 package 的思考指南。

```bash
python3 ./.trellis/scripts/get_context.py --mode packages   # 列出 package / layer
```

**何时更新 Spec**：发现新的模式/约定 · 需要固化 bug 修复的预防措施 · 作出新的技术决策。

### Task 系统

每个 Task 都有自己的 `.trellis/tasks/{MM-DD-name}/` 目录，其中包含 `task.json`、`prd.md`、可选的 `design.md`、可选的 `implement.md`、可选的 `research/`，以及供支持 sub-agent 的平台使用的 Context manifest（`implement.jsonl`、`check.jsonl`）。

```bash
# Task 生命周期
python3 ./.trellis/scripts/task.py create "<title>" [--slug <name>] [--parent <dir>]
python3 ./.trellis/scripts/task.py start <name>          # 设置 active Task（可用时按 session 隔离）
python3 ./.trellis/scripts/task.py current --source      # 显示 active Task 及其来源
python3 ./.trellis/scripts/task.py finish                # 清除 active Task（触发 after_finish hook）
python3 ./.trellis/scripts/task.py archive <name>        # 移动到 archive/{year-month}/
python3 ./.trellis/scripts/task.py list [--mine] [--status <s>]
python3 ./.trellis/scripts/task.py list-archive

# Code-Spec Context（通过 JSONL 注入 implement/check agent）。
# 对支持 sub-agent 的平台，`task create` 会生成 `implement.jsonl` / `check.jsonl`；
# AI 在规划阶段按需整理真正的 Spec + 研究条目。
python3 ./.trellis/scripts/task.py add-context <name> <action> <file> <reason>
python3 ./.trellis/scripts/task.py list-context <name> [action]
python3 ./.trellis/scripts/task.py validate <name>

# Task 元数据
python3 ./.trellis/scripts/task.py set-branch <name> <branch>
python3 ./.trellis/scripts/task.py set-base-branch <name> <branch>    # PR 目标分支
python3 ./.trellis/scripts/task.py set-scope <name> <scope>

# 层级（parent/child）
python3 ./.trellis/scripts/task.py add-subtask <parent> <child>
python3 ./.trellis/scripts/task.py remove-subtask <parent> <child>

# 创建 PR
python3 ./.trellis/scripts/task.py create-pr [name] [--dry-run]
```

> 运行 `python3 ./.trellis/scripts/task.py --help` 查看权威且最新的命令列表。

**当前 Task 机制**：`task.py create` 创建 Task 目录，并在 session 身份可用时自动设置该 session 的 active-task 指针，使 planning 面包屑立即生效。`task.py start` 写入同一个指针（若已设置则保持幂等），并把 `task.json.status` 从 `planning` 改为 `in_progress`。状态存储在 `.trellis/.runtime/sessions/` 下。如果无法从 hook 输入、`TRELLIS_CONTEXT_ID` 或平台原生 session 环境变量中获得 context key，就不存在 active Task，且 `task.py start` 会失败并提示如何提供 session 身份。`task.py finish` 删除当前 session 文件（status 不变）。`task.py archive <task>` 写入 `status=completed`，把目录移动到 `archive/`，并删除所有仍指向该已归档 Task 的 runtime session 文件。

### Workspace 系统

在 `.trellis/workspace/<developer>/` 下记录每次 AI session，以便跨 session 跟踪。

- `journal-N.md` — session 日志。**每个文件最多 2000 行**；超过后自动创建新的 `journal-(N+1).md`。
- `index.md` — 个人索引（session 总数、最近活跃时间）。

```bash
python3 ./.trellis/scripts/add_session.py --title "标题" --commit "hash" --summary "摘要"
```

### Context 脚本

```bash
python3 ./.trellis/scripts/get_context.py                            # 完整 session runtime
python3 ./.trellis/scripts/get_context.py --mode packages            # 可用的 package + Spec layer
python3 ./.trellis/scripts/get_context.py --mode phase --step <X.Y>  # 某个工作流 Step 的详细指南
```

---

<!--
  WORKFLOW-STATE 面包屑契约（编辑下方标记块前请先阅读）

  嵌入下方 ## 阶段索引中的 [workflow-state:STATUS] 标记块，是所有受支持
  AI 平台的 UserPromptSubmit hook 每轮注入 `<workflow-state>` 面包屑的
  唯一事实来源。inject-workflow-state.py（Python 平台）和
  inject-workflow-state.js（OpenCode plugin）只负责解析；从 v0.5.0-rc.0
  开始，脚本中不再内置后备字典。

  STATUS 字符集：[A-Za-z0-9_-]+。当 hook 找不到标记时，会退化为通用的
  "Refer to workflow.md for current step." 提示；该问题会被有意暴露，
  以便用户注意并修复损坏的 workflow.md。

  不变量（test/regression.test.ts）：
    工作流详解中每个标记为 `[required · once]` 的 Step，都必须在所属
    Phase 的 [workflow-state:*] 标记块中有对应的强制提醒。面包屑是
    唯一的逐轮通道；如果没有提及某个必做 Step，AI 就会静默跳过它
    （Phase 1 规划 gate 和 Phase 3.4 commit 都曾因此被跳过）。

  TAG ↔ PHASE 范围：
    [workflow-state:no_task]      → 没有 active Task；位于 Phase 1 之前
    [workflow-state:planning]     → 整个 Phase 1（status='planning'）
    [workflow-state:planning-inline] → Codex inline 模式下的 Phase 1 变体
    [workflow-state:in_progress]  → 覆盖 Phase 2 + Phase 3.2-3.4
                                    （从 task.py start 到 task.py archive，
                                    status 始终为 'in_progress'）
    [workflow-state:in_progress-inline] → Codex inline 模式下的 Phase 2/3 变体
    [workflow-state:completed]    → 当前不可达：cmd_archive 在同一次调用中
                                    更新 status 并移动目录，因此解析器会
                                    失去指针（保留此标记块，供未来显式的
                                    in_progress→completed 状态转换使用）

  编辑检查清单：
    - 修改 [workflow-state:STATUS] 标记块时，也要检查对应 Phase 中
      `[required · once]` 的工作流 Step 是否同步
    - 编辑后运行 `trellis update`，把新内容推送到下游用户项目
      （按标记块管理并替换）
    - 完整 runtime 契约：
      .trellis/spec/cli/backend/workflow-state-contract.md
-->

## 阶段索引

```
Phase 1: 规划 → 分类、取得创建 Task 的同意，然后编写规划产物
Phase 2: 执行 → 只有 Task status 为 in_progress 后才实施
Phase 3: 收尾 → 验证、更新 Spec、commit 并完成收尾
```

### 请求分类

- 简单对话或小型工作：只询问本轮是否应该创建 Trellis Task。如果用户回答否，本 session 跳过 Trellis。
- 复杂工作：询问是否可以创建 Trellis Task 并进入规划。如果用户回答否，不要在当前对话中直接进行大范围实施；应解释、澄清范围，或建议拆成更小的工作。
- 用户同意创建 Task，并不代表同意开始实施。仍然必须先规划。

### 规划产物

- `prd.md` — 面向人阅读的合同，固定章节依次为 `Goal`（目标）、`Requirements`（需求）和 `User-visible Outcomes`（用户可见结果）。目标使用有序列表，结果使用可核验 checklist（检查清单）；不要在这里放技术设计或执行检查清单。
- 技术设计进入 `design.md`；有序实施工作和验证命令进入 `implement.md`；源码诊断和 `file:line` 证据进入 `research/`。
- `design.md` — 复杂 Task 的技术设计：边界、契约、数据流、权衡、兼容性、发布/回滚方案。
- `implement.md` — 复杂 Task 的执行计划：有序检查清单、验证命令、审核 gate 和回滚点。
- `implement.jsonl` / `check.jsonl` — sub-agent Context 使用的 Spec 和研究清单。它们不能替代 `implement.md`。
- 轻量 Task 可以只有 PRD。复杂 Task 在运行 `task.py start` 前必须具备 `prd.md`、`design.md` 和 `implement.md`。

### PRD 图和 UI 门禁

仅当依赖或流程难以用文字理解时才使用 Mermaid 图。关键路径必须使用 `classDef critical`、关键节点的 `critical` class（类）、红色 `linkStyle` 和明确文字标签；不能只依赖颜色表达。

对于 UI Task，PRD 的用户可见结果必须包含原型和明确确认。最终规划摘要须报告 `prototype status: pending_user_approval` 或 `approved`；待确认状态会阻止 `task.py start`。

### 父/子 Task 树

当一个用户请求包含多个可独立验证的交付物时，使用 parent Task。parent Task 负责原始需求集合、Task 映射、跨 child 验收标准和最终集成审核；除非它本身也有直接工作，否则通常不应作为实施目标。

child Task 用于可独立规划、实施、检查和归档的交付物。parent/child 结构不是依赖系统：如果某个 child 必须等待另一个 child，请把顺序写入该 child 的 `prd.md` / `implement.md`，并确保每个 child 的验收标准都可测试。

使用 `task.py create "<title>" --slug <name> --parent <parent-dir>` 创建新的 child。使用 `task.py add-subtask <parent> <child>` 关联已有 Task，使用 `task.py remove-subtask <parent> <child>` 解除错误关联。

<!-- 每轮面包屑：没有 active Task 时显示（Phase 1 之前） -->

[workflow-state:no_task]
没有 active Task。首先对当前轮次进行分类，并在创建任何 Trellis Task 前取得用户对创建 Task 的同意。
简单对话 / 小型工作：只询问本轮是否应该创建 Trellis Task。如果用户回答否，本 session 跳过 Trellis。
复杂工作：询问用户是否可以创建 Trellis Task 并进入规划阶段。如果用户回答否，应解释、澄清范围，或建议拆成更小的工作。
[/workflow-state:no_task]

### Phase 1: 规划
- 1.0 创建 Task `[required · once]`（仅在取得创建 Task 的同意后）
- 1.1 探索需求 `[required · repeatable]`（`prd.md`；复杂 Task 还需要 `design.md` + `implement.md`）
- 1.2 研究 `[optional · repeatable]`
- 1.3 配置 Context `[required · once]` — Claude Code、Cursor、OpenCode、Codex、Kiro、Gemini、Qoder、CodeBuddy、Copilot、Droid、Pi、Oh My Pi、ZCode、Snow、Reasonix、Grok、Kimi Code（仅适用于派发 sub-agent 的平台；内联平台跳过）
- 1.4 激活 Task `[required · once]`（通过审核 gate 后运行 `task.py start`；status → in_progress）
- 1.5 完成标准

<!-- 每轮面包屑：整个 Phase 1 期间显示（status='planning'） -->

[workflow-state:planning]
加载 `trellis-brainstorm`；停留在规划阶段。
轻量 Task：`prd.md` 可以足够。复杂 Task：完成 `prd.md`、`design.md` 和 `implement.md`；在运行 `task.py start` 前请求审核。
多交付物范围：考虑使用一个 parent Task 加多个可独立验证的 child Task；依赖关系必须写在 child 产物中，不能由树中的位置暗示。
sub-agent 模式：开始前把 `implement.jsonl` 和 `check.jsonl` 整理为 Spec/research manifest。
[/workflow-state:planning]

<!-- 每轮面包屑：codex.dispatch_mode=inline 时，在整个 Phase 1 期间显示。
     这是仅供 Codex 选择启用的 [workflow-state:planning] 替代方案。主 agent
     会在 Phase 2 直接编辑代码，因此跳过 jsonl 整理；inline 工作流加载
     `trellis-before-dev`，而不是把 JSONL 注入 sub-agent。 -->

[workflow-state:planning-inline]
加载 `trellis-brainstorm`；停留在规划阶段。
轻量 Task：`prd.md` 可以足够。复杂 Task：完成 `prd.md`、`design.md` 和 `implement.md`；在运行 `task.py start` 前请求审核。
多交付物范围：考虑使用一个 parent Task 加多个可独立验证的 child Task；依赖关系必须写在 child 产物中，不能由树中的位置暗示。
inline 模式：跳过 jsonl 整理；Phase 2 通过 `trellis-before-dev` 读取产物/Spec。
[/workflow-state:planning-inline]

### Phase 2：执行
- 2.1 实施 `[required · repeatable]`
- 2.2 质量检查 `[required · repeatable]`
- 2.3 回滚 `[on demand]`

<!-- 每轮面包屑：status='in_progress' 时显示。
     范围：整个 Phase 2 + Phase 3.2-3.4（从 task.py start 到 task.py archive，
     status 始终为 'in_progress'；只有 archive 会改变它）。因此，此 block
     必须覆盖从实施到 commit 的所有必做 Step，包括 Phase 3.3 Spec 更新和
     Phase 3.4 commit。 -->

sub-agent 派发协议适用于所有平台和所有 sub-agent，包括使用原生 Codex `SubagentStart` Context 注入及子 Agent 侧拉取回退、class-2 Gemini/Qoder/Copilot/Reasonix/Trae/Grok/Kimi Code、基于 Hook 的 ZCode/Snow，以及 `trellis-research`：每个派发提示都必须以 `Active task: <task path from task.py current>` 开头，然后才是角色专属指令。在 Grok Build 上，使用 `spawn_subagent`，并将 `subagent_type` 设置为 Trellis Agent 名称（例如 `trellis-implement`）。在 Kimi Code 上，使用匹配的 `.kimi-code/skills/trellis-<role>/SKILL.md` 说明派发内置 `coder` / `explore` sub-agent。

[workflow-state:in_progress]
工具：`trellis-implement` / `trellis-research` 仅是 sub-agent 类型（Task/Agent tool，不是 Skill；不存在这些名称的 skill）。`trellis-update-spec` 是 skill。`trellis-check` 同时存在两种形式；代码修改后验证时优先使用 Agent 形式。
流程：`trellis-implement` -> `trellis-check` -> `trellis-update-spec` -> commit (Phase 3.4) -> `/trellis:finish-work`。
主 session 默认行为：派发 implement/check sub-agent。sub-agent 自我豁免：如果已经作为 `trellis-implement` 运行，不要再启动 `trellis-implement` 或 `trellis-check`；如果已经作为 `trellis-check` 运行，不要再启动 `trellis-check` 或 `trellis-implement`。只有主 session 才负责派发。
派发提示以 `Active task: <task path from task.py current>` 开头。读取 Context 的顺序：jsonl 条目 -> `prd.md` -> `design.md if present` -> `implement.md if present`。
[/workflow-state:in_progress]

<!-- 每轮面包屑：codex.dispatch_mode=inline 且 status='in_progress' 时显示。
     这是仅供 Codex 选择启用的 [workflow-state:in_progress] 替代方案。
     主 session 直接编辑代码，而不是派发 sub-agent。 -->

[workflow-state:in_progress-inline]
流程：`trellis-before-dev` -> 编辑 -> `trellis-check` -> 验证 -> `trellis-update-spec` -> commit (Phase 3.4) -> `/trellis:finish-work`。
inline 模式下不要派发 implement/check sub-agent。
读取 Context：`prd.md` -> `design.md if present` -> `implement.md if present`，再加上 skill 加载的相关 Spec/research。
[/workflow-state:in_progress-inline]

### Phase 3：收尾
- 3.2 调试复盘 `[on demand]`
- 3.3 更新 Spec `[required · once]`
- 3.4 提交改动 `[required · once]`
- 3.5 收尾提醒

> 说明：step 3.1 已合并到 2.2（最后一轮全范围检查）和 3.4（提交前置检查）中。保留编号是为了避免破坏外部引用。

<!-- 每轮面包屑：status='completed' 时显示。
     当前在正常流程中不可达：cmd_archive 在同一次调用中写入 status='completed'
     并把 Task 目录移动到 archive/，所以 active-task 解析器会失去指针，
     hook 永远不会在已归档 Task 上触发。保留此标记块，供未来状态转换重构
     使用（例如显式的 in_progress→completed command）。请通过与其他生效标记块
     相同的 Spec 渠道编辑它。 -->

[workflow-state:completed]
代码已 commit。运行 `/trellis:finish-work`；如果工作区仍有未提交改动，先返回 Phase 3.4。
[/workflow-state:completed]

### 规则

1. 识别当前所在的 Phase，然后从该 Phase 的下一个 Step 继续
2. 在每个 Phase 内按顺序执行 Step；不能跳过 `[required]` Step
3. Phase 可以回滚（例如，执行时发现 PRD 缺陷 → 返回规划阶段修复，然后重新进入执行阶段）
4. 如果输出已经存在，跳过标记为 `[once]` 的 Step；不要重复运行
5. 根据产物是否存在判断下一步；对轻量 Task，缺少 `design.md` / `implement.md` 是正常的；对复杂 Task，这意味着规划尚未完成。

### 当前 Task 路由

当用户请求与 active Task 中的以下意图之一匹配时，先进行路由，再按需加载详细 Phase Step。

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

- 正在规划或需求不清楚 -> `trellis-brainstorm`。
- `in_progress` 实施/检查 -> 派发 `trellis-implement` / `trellis-check`。
- 反复调试 -> `trellis-break-loop`；更新 Spec -> `trellis-update-spec`。

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

[codex-inline, Kilo, Antigravity, Devin]

- 正在规划或需求不清楚 -> `trellis-brainstorm`。
- 编辑前 -> `trellis-before-dev`；编辑后 -> `trellis-check`。
- 反复调试 -> `trellis-break-loop`；更新 Spec -> `trellis-update-spec`。

[/codex-inline, Kilo, Antigravity, Devin]

### 防护规则

- 同意创建 Task 并不等于同意实施；完成产物审核并运行 `task.py start` 后才能实施。
- 对轻量 Task，仅有 PRD 是有效的；复杂 Task 需要 `design.md` + `implement.md`。
- 规划必须持久化到 Task 产物；报告完成前必须执行检查。

### 加载 Step 详情

每个 Step 都运行以下命令来获取详细指南：

```bash
python3 ./.trellis/scripts/get_context.py --mode phase --step <step>
# 例如：python3 ./.trellis/scripts/get_context.py --mode phase --step 1.1
```

---

## Phase 1：规划

目标：对请求分类，在需要 Task 时取得创建 Task 的同意，并产出实施前所需的规划产物。

#### 1.0 创建 Task `[required · once]`

仅在取得创建 Task 的同意后创建 Task 目录。该命令把 status 设为 `planning`，写入 `task.json`，创建默认 `prd.md`，并在 session identity 可用时自动把新 Task 设为目标：

```bash
python3 ./.trellis/scripts/task.py create "<task title>" --slug <name>
```

`--slug` 只是人类可读名称。**不要**包含 `MM-DD-` 日期前缀；`task.py create` 会自动添加该前缀。

对于 Task 树，先创建 parent Task，再使用 `--parent <parent-dir>` 创建每个 child。不要仅仅因为存在 child 就 start parent；应 start 负责下一个可独立验证交付物的 child。

该命令成功后，每轮面包屑会自动切换到 `[workflow-state:planning]`，提醒 AI 停留在规划阶段。

这里只运行 `create`，不要同时运行 `start`。`start` 会把 status 改为 `in_progress`，从而在规划产物审核前就把面包屑切到实施阶段。把 `start` 留到 1.4。

当 `python3 ./.trellis/scripts/task.py current --source` 已指向某个 Task 时跳过。

#### 1.1 探索需求 `[required · repeatable]`

加载 `trellis-brainstorm` skill，并按照该 skill 的指南与用户交互式探索需求。

brainstorm skill 会指导你：
- 每次只问一个问题
- 优先 research，而不是询问用户
- 优先提供选项，而不是提出开放式问题
- 用户每次回答后立刻更新 `prd.md`
- 当交付物可以独立验证时，把大范围工作拆成一个 parent Task 和多个 child Task
- 让 `prd.md` 聚焦目标、需求和用户可见结果。UI Task 必须在用户可见结果中包含原型，并在用户明确确认前报告 `prototype status: pending_user_approval`；待确认时不得运行 `task.py start`。
- 对复杂 Task，在开始实施前产出 `design.md` 和 `implement.md`

考虑 parent/child 拆分时：
- 当一个请求包含多个可独立验证的交付物时，使用 parent Task。
- parent Task 负责原始需求、child Task 映射、跨 child 验收标准和最终集成审核。
- child Task 负责可独立规划、实施、检查和归档的实际交付物。
- parent/child 结构不是依赖系统。如果 child B 依赖 child A，请把顺序写入 child B 的 `prd.md` / `implement.md`。
- start 负责下一个交付物的 child Task。除非 parent 本身有直接实施工作，否则不要 start parent。

每当需求发生变化，就返回此 Step 并修改相关产物。

#### 1.2 研究 `[optional · repeatable]`

研究可以在需求探索期间的任何时刻进行，并不限于本地代码。你可以使用任何可用工具（MCP server、skill、网络搜索等）查找外部信息，包括第三方库文档、行业实践、API 参考资料等。

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

启动 research sub-agent：

- **Agent 类型**：`trellis-research`
- **Task 描述**：研究 <specific question>
- **关键要求**：研究输出必须持久化到 `{TASK_DIR}/research/`

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

[codex-inline, Kilo, Antigravity, Devin]

直接在主 Session 中完成研究，并把发现写入 `{TASK_DIR}/research/`。`codex-inline` 是明确要求在主 Session 中执行工作的模式。

[/codex-inline, Kilo, Antigravity, Devin]

**研究产物约定**：
- 每个研究主题一个文件（例如 `research/auth-library-comparison.md`）
- 把第三方库使用示例、API 参考资料、版本约束记录到文件中
- 记录你发现的相关 Spec 文件路径，供后续参考

需求探索和研究可以自由交错——暂停去研究一个技术问题，然后回来继续与用户讨论。

**关键原则**：研究输出必须写入文件，不能只留在聊天中。对话会被压缩，文件不会。

#### 1.3 配置 Context `[required · once]`

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

整理 `implement.jsonl` 和 `check.jsonl`，让 Phase 2 sub-agent 获得正确的 Spec/研究 Context。这些文件由 `task create` 生成，初始只有一行自描述的 `_example`；你需要填写真正的条目。

**位置**：`{TASK_DIR}/implement.jsonl` 和 `{TASK_DIR}/check.jsonl`（已经存在）。

**格式**：每行一个 JSON 对象 — `{"file": "<path>", "reason": "<why>"}`。路径相对于 repo root。

**应放入的内容**：
- **Spec 文件** — `.trellis/spec/<package>/<layer>/index.md`，以及与此 Task 相关的具体规范文件（`error-handling.md`、`conventions.md` 等）
- **研究文件** — sub-agent 需要查阅的 `{TASK_DIR}/research/*.md`

**不应放入的内容**：
- 代码文件（`src/**`、`packages/**/*.ts` 等）——sub-agent 在实施过程中自行读取，不需要预先登记
- 你即将修改的文件——原因相同

**两个文件的分工**：
- `implement.jsonl` → implement sub-agent 正确编码所需的 Spec + 研究资料
- `check.jsonl` → check sub-agent 使用的 Spec（质量规范、检查约定，必要时包含同一份研究资料）

这些 manifest 不能替代 `implement.md`。`implement.md` 是复杂 Task 面向人类的执行计划；jsonl 文件只列出需要注入或加载的 Context 文件。

**如何发现相关 Spec**：

```bash
python3 ./.trellis/scripts/get_context.py --mode packages
```

列出每个 package 及其 Spec layer 和路径。选择与此 Task 领域匹配的条目。

**如何追加条目**：

可以直接在编辑器中修改 jsonl 文件，也可以使用：

```bash
python3 ./.trellis/scripts/task.py add-context "$TASK_DIR" implement "<path>" "<reason>"
python3 ./.trellis/scripts/task.py add-context "$TASK_DIR" check "<path>" "<reason>"
```

有真实条目后，可以删除 seed `_example` 行（可选——使用方会自动跳过它）。

就绪门禁：运行 `task.py start` 前，`implement.jsonl` 和 `check.jsonl` 都必须至少包含一条真实的 `{"file": "...", "reason": "..."}` 记录。只有 seed `_example` 行不算就绪。

仅当两个文件都已有真实的整理记录时，才跳过此步骤。

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

[codex-inline, Kilo, Antigravity, Devin]

跳过此 Step。Phase 2 中由 `trellis-before-dev` skill 直接加载 Context。

[/codex-inline, Kilo, Antigravity, Devin]

#### 1.4 激活 Task `[required · once]`

产物审核通过后，把 Task status 改为 `in_progress`：

```bash
python3 ./.trellis/scripts/task.py start <task-dir>
```

轻量 Task 可以只有 `prd.md`。复杂 Task 必须先完成并审核 `prd.md`、`design.md` 和 `implement.md`。在派发 sub-agent 的平台上，开始前 `implement.jsonl` 和 `check.jsonl` 都必须包含真实的整理记录。Runtime 使用方为了兼容性可以容忍文件缺失或只有 seed 的 manifest，但这不代表规划已就绪。

该命令成功后，每轮面包屑会自动切换到 `[workflow-state:in_progress]`，后续进入 Phase 2 / 3。

如果 `task.py start` 因 session 身份报错（无法从 hook 输入、`TRELLIS_CONTEXT_ID` 或平台原生 session 环境变量获得 context key），请按错误提示设置 session 身份，然后重试。

#### 1.5 完成标准

| 条件 | 必须 |
|------|:---:|
| `prd.md` 存在 | ✅ |
| 用户确认 Task 应进入实施阶段 | ✅ |
| 已运行 `task.py start`（status = in_progress） | ✅ |
| `research/` 中有产物（复杂 Task） | 建议 |
| `design.md` 存在（复杂 Task） | ✅ |
| `implement.md` 存在（复杂 Task） | ✅ |

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

| `implement.jsonl` 和 `check.jsonl` 各自至少包含一条真实的整理记录（seed 行不计入） | ✅ |

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

---

## Phase 2：执行

目标：把已经审核的规划产物变成通过质量检查的代码。

#### 2.1 实施 `[required · repeatable]`

[Claude Code, Cursor, OpenCode, codex-sub-agent, CodeBuddy, Droid, Pi, ZCode, Snow, Oh My Pi]

启动 implement sub-agent：

- **Agent 类型**：`trellis-implement`
- **Task 描述**：按照已审核的 Task 产物实施，查阅 `{TASK_DIR}/research/` 中的材料；最后运行项目 lint 和 type-check
- **派发提示防护规则**：提示必须以 `Active task: <task path>` 开头，然后告诉已启动的 Agent，它已经是 `trellis-implement` sub-agent，必须直接实施，不要再启动 `trellis-implement` / `trellis-check`。

平台 hook/plugin 会自动：
- 读取 `implement.jsonl`，并把所引用的 Spec/研究文件注入 agent prompt
- 注入 `prd.md`、存在时的 `design.md` 和存在时的 `implement.md`
- 对 Codex，`SubagentStart` 提供原生 Context 注入；Agent 配置保留子 Agent 侧加载作为回退

[/Claude Code, Cursor, OpenCode, codex-sub-agent, CodeBuddy, Droid, Pi, ZCode, Snow, Oh My Pi]

[Gemini, Qoder, Copilot, Reasonix, Trae, Grok, Kimi Code]

启动 implement sub-agent：

- **Agent 类型**：`trellis-implement`
- **Task 描述**：按照已审核的 Task 产物实施，查阅 `{TASK_DIR}/research/` 中的材料；最后运行项目 lint 和 type-check
- **派发提示防护规则**：提示必须以 `Active task: <task path>` 开头，然后明确已启动的 agent 已经是 `trellis-implement`，必须直接实施，不能再启动 `trellis-implement` / `trellis-check`。

基于拉取的 sub-agent 定义会自动加载 Context：
- 通过 `task.py current --source` 解析 active Task，然后读取 `prd.md`、存在时的 `design.md` 和存在时的 `implement.md`
- 读取 `implement.jsonl`，要求 agent 在编码前加载每个所引用的 Spec/研究文件

[/Gemini, Qoder, Copilot, Reasonix, Trae, Grok, Kimi Code]

[Kiro]

启动 implement sub-agent：

- **Agent 类型**：`trellis-implement`
- **Task 描述**：按照已审核的 Task 产物实施，查阅 `{TASK_DIR}/research/` 中的材料；最后运行项目 lint 和 type-check
- **派发提示防护规则**：告诉已启动的 agent，它已经是 `trellis-implement` sub-agent，必须直接实施，不要再启动 `trellis-implement` / `trellis-check`。

平台 prelude 会自动：
- 读取 `implement.jsonl`，并把所引用的 Spec/研究文件注入 agent prompt
- 注入 `prd.md`、存在时的 `design.md` 和存在时的 `implement.md`

[/Kiro]

[codex-inline, Kilo, Antigravity, Devin]

1. 加载 `trellis-before-dev` skill，读取项目规范
2. 读取 `{TASK_DIR}/prd.md`，然后读取存在时的 `design.md`，再读取存在时的 `implement.md`
3. 查阅 `{TASK_DIR}/research/` 中的材料
4. 按已经审核的产物实施代码
5. 运行项目 lint 和 type-check

[/codex-inline, Kilo, Antigravity, Devin]

#### 2.2 质量检查 `[required · repeatable]`

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

启动 check sub-agent：

- **Agent 类型**：`trellis-check`
- **Task 描述**：根据 Spec 和 Task 产物审核所有代码改动；直接修复发现的问题；确保 lint 和 type-check 通过
- **派发提示防护规则**：提示必须以 `Active task: <task path>` 开头，然后告诉已启动的 Agent，它已经是 `trellis-check` sub-agent，必须直接审核/修复，不要再启动 `trellis-check` / `trellis-implement`。

检查 agent 的职责：
- 根据 Spec 审核代码改动
- 根据 `prd.md`、存在时的 `design.md` 和存在时的 `implement.md` 审核代码改动
- 自动修复发现的问题
- 运行 lint 和 typecheck 进行验证

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

[codex-inline, Kilo, Antigravity, Devin]

加载 `trellis-check` skill，并按照其指南验证代码：
- 是否符合 Spec
- lint / type-check / test
- 跨 layer 一致性（当改动跨越多个 layer 时）

如果发现问题 → 修复 → 重新检查，直到全部通过。

[/codex-inline, Kilo, Antigravity, Devin]

**最终检查（Phase 3.4 提交前）**：一个 Task 的最后一次 2.2 必须覆盖全部范围，而不只是最新的实现片段。使用 `python3 ./.trellis/scripts/get_context.py --mode packages` 列出所有受影响的 Package，再加载每个 Package 的 Spec 索引中 Quality Check 部分。这可以发现中途局部 2.2 遗漏的跨 Layer / 多 Package 问题。

#### 2.3 回滚 `[on demand]`

- `check` 发现 PRD 缺陷 → 返回 Phase 1，修复 `prd.md`，然后重新执行 2.1
- 实施方向错误 → 回退代码，重新执行 2.1
- 需要更多研究 → 进行研究（同 Phase 1.2），并把发现写入 `research/`

---

## Phase 3：收尾

目标：确保代码质量、沉淀经验并记录工作。

#### 3.2 调试复盘 `[on demand]`

如果此 Task 涉及反复调试（同一个问题修复了多次），加载 `trellis-break-loop` skill：
- 对根因分类
- 解释之前的修复为什么失败
- 提出预防措施

目标是沉淀调试经验，避免同类问题再次发生。

#### 3.3 更新 Spec `[required · once]`

加载 `trellis-update-spec` skill，审核此 Task 是否产生了值得记录的新知识：
- 新发现的模式或约定
- 遇到的陷阱
- 新的技术决策

相应更新 `.trellis/spec/` 下的文档。即使结论是“没有需要更新的内容”，也要完成这一判断过程。

#### 3.4 提交改动 `[required · once]`

**Spec 同步前置检查**：拟定 commit 前，先问：此 Task 是否修复了缺陷，或发现了应该写入 `.trellis/spec/` 的非显而易见知识，以免未来的自己（或 AI）重复犯错？如果是，先返回 Phase 3.3——Spec 改动应进入同一 Task 的 commit 批次，而不是被遗忘的后续事项。

AI 负责按批次 commit 此 Task 的代码改动，使 `/finish-work` 之后可以在干净的工作区运行。目标是先生成工作 commit，再生成记录管理（archive + journal）commit——不要交错。

**操作步骤**：

1. **检查未提交状态**：
   ```bash
   git status --porcelain
   ```
   记录每个未提交路径。如果工作树干净，跳到 3.5。

2. **从近期历史学习 commit 风格**（使拟定的提交信息与现有风格一致）：
   ```bash
   git log --oneline -5
   ```
   观察前缀约定（`feat:` / `fix:` / `chore:` / `docs:` 等）、语言（中文/英文）和长度风格。

3. **把未提交文件分成两组**：
   - **本 session 由 AI 编辑** — 本 session 中通过 Edit/Write/Bash tool call 写入或编辑的文件。你知道改了什么以及原因。
   - **无法识别** — 本 session 中你没有触碰的未提交文件（可能是用户手动修改、上个 session 遗留的 WIP，或不相关工作）。不要静默包含它们。

4. **拟定 commit 计划**。把 AI 编辑的文件按逻辑 commit 分组（每个一致的改动单元一个 commit，而不是每个文件一个 commit）。每项包含 `<commit message>` 和文件列表。最后单独列出无法识别的文件。

5. **只展示一次 plan，并请求一次性确认**。格式：
   ```
   拟议的 commit（按顺序）：
     1. <message>
        - <file>
        - <file>
     2. <message>
        - <file>

   无法识别的未提交文件（不会加入任何 commit——请确认包含/排除）：
     - <file>
     - <file>

   回复 'ok' / '行' 执行。回复修改意见，或回复 '我自己来' / 'manual' 终止。
   ```

6. **确认后**：按顺序对每个批次运行 `git add <files>` + `git commit -m "<msg>"`。不要 amend。不要 push。

7. **拒绝后**（用户回复“不行” / “我自己来” / “manual”，或对 plan 有任何异议）：停止。不要尝试第二份 plan。用户将手动 commit；他们确认后，跳到 3.5。

**规则**：
- 任何地方都不能使用 `git commit --amend`——遵守三阶段三 commit 流程（工作 commit → archive commit → journal commit）。
- 此 Step 不得 push 到 remote。
- 如果用户只想修改提交信息措辞，但接受文件分组，则修改提交信息并再确认一次；如果他们拒绝分组，则进入手动模式。
- 批次计划只询问一次；不要对每个 commit 分别询问。

#### 3.5 收尾提醒

完成上述步骤后，提醒用户可以运行 `/finish-work` 进行收尾（归档 Task、记录 session）。

---

## 自定义 Trellis（适用于 fork）

本节面向希望修改 Trellis 工作流本身的开发者。所有自定义都通过编辑此文件完成；脚本只负责解析。

### 修改 Step 的含义

编辑上方 Phase 1 / 2 / 3 中相应 Step 的工作流详解。关键不变量：
- 没有 active Task 时，必须先分类，并在创建 Trellis Task 前取得创建 Task 的同意。
- 规划必须区分仅有 PRD 的轻量 Task 和复杂 Task；复杂 Task 在 start 前需要 `prd.md`、`design.md` 和 `implement.md`。
- 每条必做执行路径都必须确保 Phase 3.4 commit 提醒在 `/trellis:finish-work` 前可达。

所有标记块都位于上方 `## Phase Index` 区域中，并紧跟在各 Phase 摘要之后：

| 范围 | 对应 tag |
|---|---|
| 没有 active Task（Phase 1 之前） | `[workflow-state:no_task]`（位于阶段索引 ASCII 图后） |
| 整个 Phase 1（Task 已创建 → 可以实施） | `[workflow-state:planning]`（位于 Phase 1 摘要后） |
| Codex inline 的 Phase 1 | `[workflow-state:planning-inline]` |
| Phase 2 + Phase 3.2–3.4（实施 + 检查 + 收尾） | `[workflow-state:in_progress]`（位于 Phase 2 摘要后） |
| Codex inline 的 Phase 2 + Phase 3.2–3.4 | `[workflow-state:in_progress-inline]` |
| Phase 3.5 之后（已归档） | `[workflow-state:completed]`（位于 Phase 3 摘要后；**当前不可达**） |

### 修改每轮 prompt 文本

直接编辑相应 `[workflow-state:STATUS]` 标记块的正文。编辑后，运行 `trellis update`（如果你是模板维护者），或重启 AI session（如果你在自定义自己的项目）——不需要修改脚本。

### 添加自定义 status

添加一个新 block：

```
[workflow-state:my-status]
你的每轮 prompt 文本
[/workflow-state:my-status]
```

约束：
- STATUS 字符集：`[A-Za-z0-9_-]+`（允许下划线和连字符，例如 `in-review`、`blocked-by-team`）
- lifecycle hook 必须把 `task.json.status` 写为你的自定义值，否则该标记永远不会被读取
- lifecycle hook 位于 `task.json.hooks.after_*`，并绑定到 `after_create / after_start / after_finish / after_archive` 之一

### 添加 lifecycle hook

在你的 `hooks` field 中添加到 `task.json`：

```json
{
  "hooks": {
    "after_finish": [
      "你的脚本或命令"
    ]
  }
}
```

支持的事件：`after_create / after_start / after_finish / after_archive`。请注意，`after_finish` ≠ status 变化（它只清除 active-task 指针）；“Task 已完成”通知应使用 `after_archive`。

### 完整契约

关于工作流状态机的 runtime 契约、所有 status 写入器的位置、伪 status（`no_task` / `stale_<source_type>`）、hook 可达性矩阵和其他深入细节，请参阅：

- `.trellis/spec/cli/backend/workflow-state-contract.md` — runtime 契约 + 写入器表 + 测试不变量
- `.trellis/scripts/inject-workflow-state.py` — 实际解析器（只读取 workflow.md，不内置文本）

<!-- prd-contract:START -->
## PRD 合同

最终 `prd.md` 的固定章节依次为 目标（`Goal`）、需求（`Requirements`）和 用户可见结果（`User-visible Outcomes`）。目标使用有序列表，用户可见结果使用检查清单。技术设计进入 `design.md`；有序执行进入 `implement.md`；源码诊断进入 `research/`。

用户界面工作必须在用户可见结果中包含原型，并在用户明确确认前报告 `prototype status: pending_user_approval`；待确认时不得运行 `task.py start`。

仅当流程图确实提升理解时才使用。 关键路径必须有明确标签、`classDef critical`、`class ... critical` 和红色 `linkStyle`（`stroke:#dc2626`）；不能只依赖颜色。
<!-- prd-contract:END -->

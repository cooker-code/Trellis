# 调研：PR1-B workflow（工作流）运行时解析器审计

- **查询**：在完整翻译 `workflow.zh.md` 前审查每个 `workflow.md` 运行时消费者。
- **范围**：内部。
- **日期**：2026-07-27

## 当前源状态

- 规范英文源：`packages/cli/src/templates/trellis/workflow.md`（710 行）；
- 中文源：`packages/cli/src/templates/trellis/workflow.zh.md`（700 行）；
- 中文文件仍是 PR1-A 示例：仅开头部分已翻译，保留显式 placeholder 注释，其余为旧英文 workflow 正文；
- 中文副本结构已过时，缺少当前英文的 `Request Triage`、`Planning Artifacts`、`Parent / Child Task Trees`、`Active Task Routing`、`Guardrails` 等章节，且 marker 行数不同（中文 30 行、英文 26 行）；
- `.trellis/workflow.md` 当前与打包英文源逐字一致，并非中文源。

## 已经语言无关的安全结构

| 消费者 | 结构 | 中文正文安全原因 |
|---|---|---|
| `shared-hooks/inject-workflow-state.py` | `[workflow-state:STATUS]...[/workflow-state:STATUS]` | regex（正则表达式）仅匹配保留标签，正文原样输出（`:170-203`）。 |
| `opencode/plugins/inject-workflow-state.js` | 相同 workflow-state 标签 | 相同标签/反向引用契约（`:32-98`）。 |
| `workflow_phase.py:get_step` | `#### <X.Y>` | `_STEP_HEADING_RE` 只匹配保留的数值 Step ID，不依赖英文标题（`:34`、`:100-126`）。 |
| `workflow_phase.py:filter_platform` | `[Platform A, ...]` marker | marker 值明确保留（`:31`、`:47-60`、`:171-205`）。 |

因此可翻译 breadcrumb 正文、Step 标题、段落、表格、示例和注释，前提是 workflow-state 标签、Step ID 与平台 marker 完全保留。

## 依赖英文 Phase Index 标题的消费者

以下五条已发布路径依赖精确英文标题：

1. `packages/cli/src/templates/trellis/scripts/common/workflow_phase.py`：`_PHASE_INDEX_HEADING = "## Phase Index"`（`:38`），结束边界为 `"## Phase 1: Plan"`（`:80`）；
2. `packages/cli/src/templates/shared-hooks/session-start.py`：`_build_workflow_overview` 调用 `_extract_range(content, "Phase Index", "Phase 1: Plan")`（`:714`）；
3. `packages/cli/src/templates/codex/hooks/session-start.py`：相同调用（`:461`）；
4. `packages/cli/src/templates/copilot/hooks/session-start.py`：相同调用（`:466`）；
5. `packages/cli/src/templates/opencode/lib/session-utils.js`：精确比较（`:399-404`）。

若翻译 `## Phase Index` 与 `## Phase 1: Plan`，上述路径会返回空的紧凑概览；Step 提取仍因数值稳定而可用。

## 推荐的解析器兼容策略

委派范围要求翻译所有自然语言标题，同时保持 Phase/Step **数字**。应使用语言无关的边界算法：

1. 先使用现有精确英文查找，以兼容缺少 `no_task` 的自定义 workflow；
2. 否则寻找保留的 `[workflow-state:no_task]` 开标签；
3. 向后扫描到最近的二级 Markdown 标题（`## `），作为 Phase Index 起点；
4. 从该标题向前扫描到下一个二级标题，作为详细 Phase 1 讲解的排他结束点；
5. 两种锚点均不存在时保留现有失败行为（空概览/调用方既有回落）。

不要硬编码 `阶段索引` / `Phase 1：规划`。这会重复语言耦合，并要求每种未来语言修改解析器。已有 workflow-state 标签是文档化的稳定机器标识，且能唯一定位已发布 Phase Index。独立 hook 副本应实现等效逻辑，不要为 PR1-B 引入跨文件导入重构。

## 必须保持的行为

- workflow-state STATUS 字符集继续为 `[A-Za-z0-9_-]+`，开闭标签使用相同 STATUS 反向引用；
- `get_step("X.Y")` 仍在下一个 `####`、`##` 或水平线终止；
- 平台匹配保持大小写及分隔符不敏感；
- Codex `planning-inline` / `in_progress-inline` 选择不变；
- SessionStart 仍从紧凑概览移除 breadcrumb 块、HTML 注释及平台 marker 行；
- 缺失/畸形 workflow 结构维持可见回落，不新增隐式翻译回落字典；
- 英文 workflow 字节不变。

## 受影响测试与注意事项

- Phase Index/SessionStart 运行时测试集中于 `packages/cli/test/regression.test.ts:3364-3574`，应补充中文；
- OpenCode SessionStart 由 `packages/cli/test/templates/opencode.test.ts` 覆盖，若改 JS 边界逻辑应增加中文源用例；
- `packages/cli/test/regression.test.ts:2696-2965` 的 breadcrumb 测试可保留，因为标签不变；
- `packages/cli/test/templates/trellis.test.ts` 的英文语义断言继续使用旧英文导出，中文一致性断言应增量添加；
- 不能仅使用“首个 H2/第二个 H2”算法；必须锚定 `[workflow-state:no_task]`，避免 frontmatter 或引言 H2 改变范围；
- 不得翻译或重命名 `[workflow-state:no_task]`；它同时是 breadcrumb 键和语言无关 Phase Index 锚点；
- `# Development Workflow - Session Summary` 等 hook 生成包装文案不在 PR1-B 内容范围，只有由 workflow 派生的正文变为中文；
- 解析器改动须按项目 workflow-state contract（工作流状态契约）审查，实施前阅读 `.trellis/spec/cli/backend/workflow-state-contract.md`。

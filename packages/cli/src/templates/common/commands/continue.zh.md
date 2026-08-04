# 继续当前任务

恢复当前 Task，并从 `.trellis/workflow.md` 中正确的 phase/step 继续。

---

## Step 1：加载当前上下文

```bash
{{PYTHON_CMD}} ./.trellis/scripts/get_context.py
```

确认：当前 Task、Git 状态、最近提交。

## Step 2：加载 Phase 索引

```bash
{{PYTHON_CMD}} ./.trellis/scripts/get_context.py --mode phase
```

显示 Phase 索引（规划 / 执行 / 收尾），包括路由和 Skill 映射。

## Step 3：判断当前位置

`get_context.py` 会显示当前 Task 的 `status` 字段。根据 `status` + 产物是否存在进行路由。此命令用于避免用户记忆 Trellis 流程；它本身不批准实现。

- `status=planning` + 没有 `prd.md` → **1.1**（加载 `trellis-brainstorm`）
- `status=planning` + 已有 `prd.md` → 运行 `task.py planning-status <task>`。画像为 `pending` 时返回 **1.1**；推导为 `lightweight` 时可以进入 **1.4** 审查；推导为 `complex` 时返回 **1.1**，直到补齐 `design.md` + `implement.md`。
- `status=planning` + 复杂产物已完成 + sub-agent JSONL 尚未整理（只有种子 `_example` 记录）→ **1.3**
- `status=planning` + `planning-status` 有效 + 必需 JSONL 已整理或使用行内模式 → **1.4**（请求启动审查）。对于 `meta.ui=true`，还必须完成 `prototype/manifest.json` 声明的主入口和预览，用 `task.py prototype-status <task>` 读取入口、当前摘要和状态，展示最新原型，并用 `task.py approve-prototype <task> <approval-evidence>` 记录用户确认后，才能运行 `task.py start`。
- `status=in_progress` + 尚未开始实现 → **2.1**
- `status=in_progress` + 实现完成但尚未检查 → **2.2**
- `status=in_progress` + 检查已通过 → **3.1**
- `status=completed`（少见；通常会立即归档）→ 归档流程

Phase 规则（完整详情见 `.trellis/workflow.md`）：

1. 在一个 Phase 内按顺序执行步骤——不得跳过 `[required]` 步骤
2. 如果必需输出已经存在，则 `[once]` 步骤视为已完成。层级必须由已持久化画像推导，不能自由判断：`lightweight` 可以只有 `prd.md`；`complex` 还需要 `design.md` 和 `implement.md`；`pending` 不能启动。
3. 如果新发现要求回退，可以返回更早的 Phase

## Step 4：加载具体步骤

确定从哪个步骤恢复后：

```bash
{{PYTHON_CMD}} ./.trellis/scripts/get_context.py --mode phase --step <X.X> --platform {{CLI_FLAG}}
```

遵循加载出的说明。每完成一个 `[required]` 步骤后，继续下一步。

---

## 参考

完整 workflow 和详细 Phase 步骤位于 `.trellis/workflow.md`。此命令只是入口——规范性指导以该文件为准。

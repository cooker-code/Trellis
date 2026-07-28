# 开始会话

初始化由 Trellis 管理的开发会话。此平台没有 session-start hook，因此请按以下步骤手动加载等价的精简上下文。

---

## Step 1：当前状态
开发者身份、Git 状态、当前 Task、活跃 Task、日志位置。

```bash
{{PYTHON_CMD}} ./.trellis/scripts/get_context.py
```

如果输出中包含以 `Trellis update available:` 开头的行，请在总结会话上下文时逐字复制完整行，不要缩短可执行的命令提示。

## Step 2：workflow 概览
精简的 Phase 索引、请求分流规则、规划产物契约，以及步骤详情命令。

```bash
{{PYTHON_CMD}} ./.trellis/scripts/get_context.py --mode phase
```

完整指南位于 `.trellis/workflow.md`（按需读取）。

## Step 3：规范索引
发现包和 Spec 层，然后读取每个相关的索引文件。

```bash
{{PYTHON_CMD}} ./.trellis/scripts/get_context.py --mode packages
cat .trellis/spec/guides/index.md
cat .trellis/spec/<package>/<layer>/index.md   # 对每个相关层执行
```

真正开始编码时，索引文件会列出需要读取的具体规范文档。

## Step 4：决定下一步操作
通过 Step 1，你已经知道当前 Task 和状态。检查 Task 目录：

- **当前 Task 状态为 `planning` 且没有 `prd.md`** → Phase 1.1。加载 `trellis-brainstorm` Skill。
- **当前 Task 状态为 `planning` 且存在 `prd.md`** → 留在 Phase 1。轻量 Task 可以只有 PRD；复杂 Task 需要 `design.md` + `implement.md`。运行 `task.py start` 前先加载相关的 Phase 1 步骤详情。
- **当前 Task 状态为 `in_progress`** → Phase 2 的 Step 2.1。加载步骤详情：
  ```bash
  {{PYTHON_CMD}} ./.trellis/scripts/get_context.py --mode phase --step 2.1 --platform {{CLI_FLAG}}
  ```
- **没有当前 Task** → 先分类。对于简单对话或小任务，只询问本轮是否应创建 Trellis Task。对于复杂工作，询问是否可以创建 Trellis Task 并进入规划。若用户拒绝，本会话跳过 Trellis。

---

## Skill 路由（快速参考）

| 用户意图 | Skill |
|---|---|
| 新功能 / 需求不清晰 | `trellis-brainstorm` |
| 即将编写代码 | `trellis-before-dev` |
| 编码完成 / 质量检查 | `trellis-check` |
| 卡住 / 同一缺陷修复多次 | `trellis-break-loop` |
| 学到了值得沉淀的内容 | `trellis-update-spec` |

完整规则和反合理化表位于 `.trellis/workflow.md`。

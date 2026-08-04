# UI 原型目录与启动硬门禁

## 目标

1. 为涉及用户界面或交互设计的 UI Task 建立与 `research/` 同级的标准 `prototype/` 目录，使交互原型、静态预览和批准依据能够随 Task 一起保存、回放和审计。
2. 将“最新原型完成并得到用户明确确认”从 Workflow/Skill 文字规则升级为 `task.py start` 的可执行门禁，避免 UI Task 在原型缺失、过期或待确认时进入 `in_progress`。
3. 保持非 UI Task 和未显式迁移的历史 Task 行为不变，并让生成模板、dogfood 文件、双语工作流、平台 Skill、文档和测试使用同一合同。

## 需求

- UI Task 必须使用独立目录 `.trellis/tasks/<task>/prototype/`，不得继续把 `prototype.html`、预览图或相关资源散落在 Task 根目录。
- `prototype/` 至少包含机器可读 manifest（清单）、一个主原型入口和一张静态预览；独立 CSS、JavaScript、字体或图片仅在实际需要时进入 `prototype/assets/`。
- `task.json.meta` 必须显式记录该 Task 是否启用 UI 原型门禁，以及对应 manifest 的 Task 内相对路径；不得通过标题、PRD 自然语言或历史文件名猜测任意 Task 是否属于 UI Task。
- manifest 必须记录主入口、预览、当前原型摘要、`pending_user_approval` 或 `approved` 状态、获批摘要以及用户确认依据。原型内容变化后，旧批准自动失效或因摘要不一致而被拒绝。
- 生命周期固定为：`task.py create` 创建 `planning` Task → 标记为 UI Task 并形成 `prototype/` → 完成主原型和预览 → 用户明确确认最新原型 → `task.py start` → `in_progress`。
- `task.py start` 必须在写活动指针、修改 `task.json.status` 或触发 `after_start` hook 之前执行门禁；失败时返回非零退出码、输出缺失或不一致项，并保持所有生命周期状态不变。
- 门禁必须覆盖有 session identity（会话身份）和 degraded mode（降级模式）两条 `cmd_start` 分支，不能只保护其中一条。
- 非 UI Task、没有启用原型门禁的历史 Task，以及现有 `task.py validate` JSONL Context（上下文）校验职责保持兼容；历史 UI Task 通过显式迁移后才进入新门禁。
- Workflow、`trellis-brainstorm`、`trellis-continue`、Task System 文档及 PRD contract（PRD 合同）必须同步说明标准目录、机器状态和 start 前置条件；生成源与 `.trellis/` dogfood 镜像保持一致。
- 测试必须覆盖正常批准、缺目录、缺主入口、缺预览、待确认、批准后原型变化、路径越界、损坏 manifest、有/无 session identity、非 UI 兼容及 `after_start` 不触发等正反场景。
- 用户已批准规划并授权进入实现；本轮完成 CLI 能力与本地验证，不执行发布、提交或合并。

## 用户可见结果

- [x] 新建或显式标记的 UI Task 会得到标准 `prototype/` 合同；用户在 Task 目录内可以直接找到主原型、预览和批准记录。
- [x] UI Task 的规划摘要可通过 `prototype-status` 清楚显示原型入口、当前版本摘要和 `prototype status`，而不是只在 PRD 中留一句无法执行的文字约束。
- [x] 原型缺失、待确认、批准已过期或引用 Task 外路径时，`task.py start` 明确拒绝启动，并列出用户可操作的修复项。
- [x] 用户批准当前原型且产物完整后，`task.py start` 正常把 Task 从 `planning` 推进到 `in_progress`，并保留现有 session 与 hook 行为。
- [x] 原型在批准后发生变化时，旧批准不能继续放行；用户必须查看并重新确认最新原型。
- [x] 非 UI Task 和未迁移历史 Task 的创建、启动、Context 校验和归档行为没有回归。
- [x] `trellis init/update` 生成的中英文 Workflow、共享 Skill、Task System 说明和 dogfood 文件对该能力表述一致。

## 范围外

- 不实现 Figma、Sketch 等外部设计平台的远程同步或权限管理。
- 不判断原型视觉质量，也不把原型批准等同于正式产品 UI 验收。
- 不自动扫描自然语言来猜测历史 Task 是否为 UI Task，不批量改写或阻塞历史 Task。
- 不改变 `planning`、`in_progress`、`completed` 的现有状态集合。

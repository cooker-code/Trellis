# 实施计划：UI 原型目录与启动硬门禁

## 1. 冻结合同与影响面

- [x] 对计划修改的每个 Python/TypeScript symbol（符号）运行 GitNexus upstream impact（上游影响）分析；`cmd_start`、`cmd_create`、`getAllScripts`、`validateContract` 和 `managedBlock` 均为 `LOW` 风险。
- [x] 固定 `task.json.meta`、`prototype/manifest.json`、摘要算法、路径边界和错误码合同。
- [x] 明确发布模板、dogfood 镜像、双语文件、平台 Skill、docs-site 和 Marketplace 的同步矩阵。

## 2. 实现 prototype 合同

- [x] 在发布模板与 dogfood `common/` 中实现可复用 prototype manifest 解析、路径 containment、摘要计算和批准状态校验。
- [x] 让 UI Task 规划路径能够显式写入 `meta.ui=true`、manifest 路径并建立标准 `prototype/`；不得根据标题猜测。
- [x] 提供 `prototype-status` 与 `approve-prototype` 辅助入口，支持检查当前原型状态、重新计算摘要和在获得用户确认后记录批准依据。
- [x] 原型文件变化后让旧 `approved_digest` 失效，并输出重新确认提示。

## 3. 接入 start 生命周期

- [x] 在 `cmd_start` 的正常与 degraded mode 分支共用副作用前 gate。
- [x] gate 失败时保持 `planning`、不移动活动指针、不触发 `after_start`，并返回非零退出码。
- [x] gate 通过后保持现有 session identity、状态写入、幂等 start 和 hook 行为。
- [x] 更新 workflow-state contract 的 writer/gate 说明，但不新增 Task status。

## 4. 同步 AI 规划规则与文档

- [x] 更新 PRD contract 和 checker，明确 `prototype/`、机器可读状态、最新原型批准和 start 硬门禁。
- [x] 同步英文/中文 Workflow、Brainstorm、Continue、Task System reference 及所有生成镜像。
- [x] 更新 docs-site/Marketplace 的既有合同镜像；遵守父仓库独立合并边界，不等待外部 PR。
- [x] 确认 `trellis init` / `trellis update` 对 pristine（未修改）文件正常更新，对用户已修改文件维持冲突保护。

## 5. 测试

- [x] 测试 manifest Schema、文本/二进制摘要稳定性、路径穿越、符号链接和损坏输入。
- [x] 集成测试已批准 UI Task 可 start；缺目录、缺入口、缺预览、pending、摘要过期和证据缺失均拒绝。
- [x] 分别覆盖有 session identity 与 degraded mode，并断言失败时 status、pointer 和 hook 均不变化。
- [x] 覆盖非 UI、历史 Task、重复 start、`task.py validate` 旧语义和 i18n（国际化）输出兼容。
- [x] 扩展 PRD contract 正向与负向 mutation（变异）测试，验证所有模板/Skill 镜像不会漂移。
- [x] 在临时仓库真实运行中英文 `task.py create` → UI 原型准备/状态读取/批准 → `task.py start` smoke test（冒烟测试）。

## 6. 质量与交付门禁

- [x] 运行受影响测试、CLI 全量测试、lint（静态检查）、typecheck（类型检查）、build（构建）和 `git diff --check`。
- [x] 运行 GitNexus `detect_changes()`；整体为 `CRITICAL`，原因是 CLI 主分发及 17 条流程进入影响图，已向用户报告并以全量测试验证。
- [x] 用真实生成项目回读 Workflow、Skill、Task 目录和失败/成功 CLI 输出。
- [ ] 将实现结果提交到独立 `codex/` 分支并按用户后续授权处理 PR/合并；本 Task 规划阶段不执行该步骤。

## 7. 回滚点

- [x] Validator 保持为独立 `common/prototype_gate.py`，可单独测试并可从 `cmd_start` 解除接入。
- [x] 回滚边界固定：若 gate 产生不可接受的兼容性回归，先移除 `cmd_start` 调用，保留向后兼容的 metadata/目录合同，再修复后重新接入。

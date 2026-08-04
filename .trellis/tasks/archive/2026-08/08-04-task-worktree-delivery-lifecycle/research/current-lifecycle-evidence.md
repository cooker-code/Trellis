# 当前生命周期证据

## 已确认行为

- `.trellis/scripts/task.py:cmd_finish` 只清除 per-session active Task 指针，然后触发 `after_finish`；不改变 Task status，也不执行 Git 集成。
- `.trellis/scripts/common/task_store.py` 创建 Task 时已经保存 `branch`、`base_branch`、`worktree_path`、`commit` 和 `pr_url`，本 Task 可以复用这些字段，不要求新增持久化模型或数据库迁移。
- `.agents/skills/trellis-finish-work/SKILL.md` 当前会检查当前 Task 的未提交文件，但通过后直接 archive 和记录 journal；没有检查 feature 是否进入 base，也没有 merge/PR/retain 的交付选择。
- `task.py archive` 会把 status 写为 `completed`、移动 Task 目录并触发 `after_archive`；当前只对已记录但不存在的 branch 发 warning，不把“未集成”作为归档门禁。
- 当前 checkout 不存在可复用的 `create-pr` 命令实现；首版兼容边界因此只返回本地、结构化 dry-run 回执，绝不 Push 或调用远端 provider，调用方再以现有 provider 工具创建 PR/MR 并记录 `pr_url`。
- `packages/cli/test/regression.test.ts` 已锁定 `task.py finish` 删除 Session runtime context 的语义，并覆盖 archive 对 stale branch 的 warning；新实现必须保留这些回归。
- workflow、Codex Skill、平台 prompts 和 Marketplace workflow 存在多份生成/镜像入口，不能只修改 dogfood `.trellis`。

## 根因

当前流程把“代码已经 commit”作为 `/trellis:finish-work` 的主要前提，但 commit 只推进 feature branch；archive 并不证明 feature 已进入 base。由于 Task 的 branch/worktree/commit 字段没有被归约为交付状态，用户最终只能从目录和 Git 引用自行寻找代码。

## 明确非目标

- 不把 Git merge 放进 `task.py finish`。
- 不默认 Push，不修改远端 branch，不把 PR/MR 状态当作本地事实。
- 不自动 rebase 或改写历史。
- 不用 `--force` 清理未知、脏或并行 worktree。
- 不让 `mindfold-ai/marketplace` 或 `mindfold-ai/docs` 外部 PR 成为 `cooker-code/Trellis` 本身的实现门禁。
- 不在本 Task 中提交 `mindfold-ai/marketplace` 子模块修改，也不更新父仓库 gitlink。

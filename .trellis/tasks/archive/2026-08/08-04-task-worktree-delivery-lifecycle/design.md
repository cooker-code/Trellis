# 技术设计

## 1. 设计结论

交付能力新增在 `delivery-status`、`deliver` 和上层 `trellis-finish-work` 编排中；不改变 `task.py finish` 的底层语义。这样既能把交付门禁绑定到 Trellis Task，又不会让“清除当前 Session 指针”意外产生 merge（合并）副作用。

## 2. 命令与数据流

```text
task.json + current Git
        ↓
delivery-status --json       只读、稳定合同
        ↓
trellis-finish-work          展示状态并询问一次交付方式
        ↓
deliver --mode ...           获得本轮授权后执行
        ↓
delivery-status --json       回读验证
        ↓
archive + journal            记录交付回执
```

`task.py finish` 继续只调用 `clear_active_task()` 和 `after_finish` hook。`task.py archive` 继续负责 `completed`、目录移动和 `after_archive`；上层 Skill 在调用 archive 前新增交付门禁。

## 3. `trellis-git-delivery.v1`

建议最小 JSON：

```json
{
  "schema_version": "trellis-git-delivery.v1",
  "task": {"id": "example", "status": "in_progress"},
  "repository": {"state": "available"},
  "feature": {"branch": "codex/example", "head": "abc1234"},
  "base": {"branch": "main", "head": "def5678"},
  "worktree": {"state": "present", "path": "/local/path", "dirty_count": 0},
  "integration": {"state": "integration_pending", "ahead": 2, "behind": 0, "conflict_state": "clear"},
  "remote": {"state": "not_checked", "pr_url": null},
  "allowed_modes": ["local-merge", "pr", "retain"],
  "next_action": "choose_delivery_mode"
}
```

CLI 输出可包含本机路径供用户恢复；日志、平台提示和外部消费者必须按各自隐私合同决定是否公开。合同不包含 remote URL、凭证、完整 diff、完整命令或文件内容。

## 4. 状态计算

- `no_code_change`：Task 无 branch/commit/worktree 交付对象，或确认没有代码变更。
- `uncommitted`：Task worktree 存在当前 Task 范围内的未提交改动。
- `committed`：feature tip 已确认，但 base 比较暂不可用。
- `integration_pending`：feature tip 不是 base 祖先且预检无冲突。
- `integration_blocked`：预检冲突、脏目标工作区、branch/worktree 归属冲突或提交不可达。
- `integrated`：feature tip 是 base 祖先。
- `cleanup_pending`：已集成但额外 worktree/可清理 feature 仍存在。
- `retained`：用户明确选择保留，Git 不变，回执说明下一步。
- `unavailable`：非 Git、字段缺失或命令失败且不能安全下结论。

## 5. 受控写操作

### 5.1 `local-merge`

首版只自动处理可以证明安全的路径。命令必须：

1. 锁定 task.json 中的 feature/base 和期望 SHA，拒绝客户端任意路径。
2. 确认来源 worktree 干净，目标 branch 存在且没有其他脏工作区风险。
3. 运行无写入冲突预检。
4. 仅在本轮明确授权后执行所选策略；策略不能由旧 Task 配置静默继承。
5. 回读 feature tip 是否已成为 base 祖先。

若 base 已前进、需要 rebase、存在冲突或目标工作区不安全，停止并推荐 PR/MR 或人工处理，不自动改写历史。

### 5.2 `pr`

当前 checkout 没有 `create-pr` 实现，因此 `deliver --mode pr` 提供最小本地兼容边界：默认 dry-run、不 Push、不调用远端 provider；无 remote 时输出结构化 `remote_unavailable` 失败。调用方使用既有 provider 工具创建 PR/MR 后记录 `pr_url`。

### 5.3 `retain`

不执行 Git 写操作。归档回执保留 feature、commit、worktree 当前状态和保留原因；用户日后可以通过 `delivery-status` 或面板恢复定位。

## 6. 清理策略

移除 worktree、删除 feature branch、删除远端 branch 分别授权和验证。首版不使用 `--force` 作为通用兜底；submodule、detached HEAD、prunable 登记和并行 Session 进入专门错误路径。

## 7. 兼容、模板与迁移

- 不修改 `task.py finish`、`after_finish`、`archive` 和 `after_archive` 的既有语义。
- 历史 Task 缺字段时状态降级，不做 schema 迁移；复用已有 `branch/base_branch/worktree_path/commit/pr_url`。
- CLI 模板为事实来源，并同步 dogfood `.trellis` 及 Codex/Claude/Cursor 等父仓库平台入口；`mindfold-ai/marketplace` 保持独立，不在本 Task 中提交或更新 gitlink。
- 增加模板相等性、生成快照和回归测试，防止只修 dogfood 文件。

## 8. 回滚

可以独立从 `trellis-finish-work` 移除交付编排并保留只读 `delivery-status`。写操作失败时不 archive、不清除 worktree、不删除 branch，保留原始现场和下一步。

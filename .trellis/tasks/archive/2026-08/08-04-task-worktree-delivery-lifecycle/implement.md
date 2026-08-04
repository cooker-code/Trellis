# 实施计划

## 0. 开工门禁

- [x] 用户批准本 Task 最新规划摘要。
- [x] 运行 `task.py start` 并加载本 Task 的 implement context。
- [x] 刷新 GitNexus 索引，对拟修改的 CLI symbol（符号）逐个执行 upstream impact（上游影响）分析；HIGH/CRITICAL 风险先报告。
- [x] 核对当前 `data-developer`、远端基线、脏工作区和额外 worktree，不覆盖并行修改。

## 1. 冻结只读合同

- [x] 为 `delivery-status` 编写失败优先的 CLI/JSON 回归测试。
- [x] 实现 Task 解析、仓库定位、branch/worktree 关联、dirty、祖先关系和冲突预检。
- [x] 保证 `--json` stdout 仅输出合同，诊断进入 stderr，退出码稳定。
- [x] 覆盖非 Git、历史缺字段、超时和命令不可用降级。

## 2. 实现受控交付

- [x] 为 `deliver --mode local-merge|pr|retain` 增加参数与权限门禁测试。
- [x] 实现期望 SHA、来源/目标 branch、脏工作区、并行 worktree 和冲突保护。
- [x] `local-merge` 完成后用祖先关系回读；失败保留现场。
- [x] `pr` 使用本地 dry-run 边界，不扩大 Push/认证边界。
- [x] `retain` 只生成回执，不修改 Git。

## 3. 修改 finish-work 编排

- [x] 在归档前调用 `delivery-status`。
- [x] 未提交时返回 Phase 3.4；未集成时一次询问 merge/PR/retain。
- [x] 交付后重新检查并生成七项回执。
- [x] 保持 `task.py finish` 现有测试和 hook 语义不变。

## 4. 安全清理

- [x] 独立实现 worktree 移除和 feature branch 删除授权。
- [x] 增加 submodule、detached、prunable、同 branch 多 worktree、脏目标工作区测试。
- [x] 清理后分别回读 worktree 登记、local ref 和提交可达性。

## 5. 模板与文档同步

- [x] 更新 `packages/cli/src/templates/` 下 CLI、workflow、finish-work Skill 和平台生成模板。
- [x] 同步父仓库内的 `.trellis/` dogfood 与 `.agents/skills/`；明确排除 Marketplace workflow 和 gitlink 更新。
- [x] 更新本地架构、Task lifecycle、平台兼容和用户命令文档。
- [x] 增加模板漂移/安装生成断言。

## 6. 验证

- [x] 运行相关 Vitest（测试框架）回归子集。
- [x] 运行 `pnpm test` 与项目规定的 CLI 全量验证。
- [x] 在临时 Git 仓库覆盖状态矩阵，不读取或改写用户真实仓库。
- [x] 运行模板/manifest/i18n（国际化）漂移检查。
- [x] 运行 GitNexus `detect_changes()` 对比 `main`，并用 unstaged 范围分离分支既有差异。
- [x] 运行 `git diff --check`。

## 7. 交付与回滚

- [x] 区分代码验证、dogfood 生成验证、临时仓库演练和远端发布。
- [x] 未经授权不 Push、不创建或合并外部 Marketplace/Docs PR。
- [x] 写操作路径保持显式授权、fast-forward only（仅快进）与失败保留现场。

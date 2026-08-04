# 外部镜像撤回与门禁解耦

## 原链路

1. 根仓库修改 bundled Workflow 和 PRD contract。
2. `.husky/pre-commit` 强制执行 `git submodule update --init marketplace`。
3. `trellis.test.ts` 逐字比较 bundled Workflow 与 Marketplace native Workflow。
4. `check-prd-contract.mjs` 写入并扫描 Marketplace Workflow，同时扫描 docs-site 的历史 PRD 表述。
5. 旧 gitlink 因而使根提交测试失败，形成外部仓库对父仓库的事实门禁。

## 撤回决策

- 对 Docs `44efba6` 和 Marketplace `5124b7e` 分别创建普通 revert commit，不改写历史。
- 根仓库 gitlink 恢复到本次增量前的 Docs `60804b5` 与 Marketplace `8cb91f8`。
- pre-commit 不再初始化 Marketplace；合同 checker 与测试只验证父仓库自己的发布模板和 dogfood 产物。
- 外部发布需要单独授权，不再作为 `cooker-code/Trellis` 提交或合并门禁。

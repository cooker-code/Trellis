# 实施计划：PRD 与 Design 规划合同强化

## 1. 前置基线与影响分析

- [x] 已确认 `08-01-ui-prototype-directory-start-gate` 仍是未提交前置基线；本 Task 未回退或伪装收口其文件，提交前必须拆分处理。
- [x] 实施前已对 `cmd_start`、`cmd_create`、`validateContract`、`getAllScripts` 运行 GitNexus upstream impact；索引内符号均为 LOW，两个前置未索引 prototype 命令标记为 UNKNOWN 并由集成测试覆盖。
- [x] 已固定 contract v2 metadata、需求/结果编号、UI 管理块和错误码合同。

## 2. 规划画像与运行时门禁

- [x] 在发布模板和 dogfood 中新增 `planning_gate.py`，实现画像校验、tier 推导、PRD/Design 合同检查和 legacy 兼容。
- [x] 在 create 路径写入 contract v2 pending 画像，增加 `set-planning-profile` 与 `planning-status`。
- [x] 在 `cmd_start` 所有副作用前串联 planning gate 与 prototype gate；失败保持 `planning`，不移动活动指针、不触发 `after_start`。
- [x] 补齐中英文可操作错误信息并把新脚本纳入发布清单。

## 3. PRD 合同

- [x] 扩展 `prd-contract.json`，声明变更类型编号、结果映射、UI prototype 管理块和交互变化图条件合同。
- [x] 让 UI Task create/approve/status 生命周期安全维护 PRD 管理块，不覆盖块外用户内容；PRD 同步失败时回滚 manifest 批准。
- [x] 更新 Brainstorm、Workflow、Continue 和 Trellis Meta 的中英文真相源及生成镜像。

## 4. Database Design 合同

- [x] `data_model_change=true` 时检查 `design.md` 的数据模型、DDL、表与字段说明、约束及迁移/回滚内容。
- [x] 覆盖原生 `COMMENT`、`COMMENT ON`、SQLite SQL 注释加数据字典三种路径，并检查 `ALTER TABLE` 字段。
- [x] 保持 Mermaid ER 图可选；只在文档中推荐多表/关系变化场景，不作为硬门禁。

## 5. 测试

- [x] 扩展 PRD contract 正向与负向 mutation tests。
- [x] 新增 lightweight/complex/pending profile、交互图、UI 管理块、DDL 注释与 legacy 兼容集成测试。
- [x] 验证正常与 degraded start 分支的状态、活动指针和 hook 零副作用。
- [x] 在临时仓库运行中英文 create → planning-profile/status → prototype（如适用）→ start smoke test。

## 6. 验证命令

- [x] `pnpm check:prd-contract`
- [x] PRD contract mutation tests 与真实中英文 create 测试。
- [x] planning-gate 集成测试。
- [x] prototype-gate 集成测试。
- [x] `pnpm --filter @mindfoldhq/trellis lint`
- [x] `pnpm --filter @mindfoldhq/trellis typecheck`
- [x] `pnpm --filter @mindfoldhq/trellis build`
- [x] `pnpm --filter @mindfoldhq/trellis i18n:check`
- [x] `python3 -m py_compile` 检查新增及修改的 Task Python runtime。
- [x] `git diff --check`
- [x] `gitnexus detect-changes -r Trellis` 与 `--scope compare --base-ref main`；当前两批脏改动叠加分别为 CRITICAL，需在提交前拆分前置 prototype 基线与本 Task。

## 7. 交付边界

- [x] 复核发布模板与 dogfood；docs-site/Marketplace 增量已按用户要求撤回，并解除父仓库 hook、checker、测试对外部镜像的门禁依赖。
- [x] 保留既有脏工作区并明确两批改动边界；未获授权未提交、推送、创建 PR、合并或发布。
- [x] 最终分别报告代码/测试、Commit、Push、父仓库合并、外部文档仓库和发布状态。

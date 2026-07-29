# 实施计划：统一 PRD 人读合同

## 0. 启动前检查

- [ ] 获得用户对本轮最终规划摘要的明确批准。
- [ ] 确认实施目标分支；当前 worktree 是 `c94d6fc2` detached HEAD，普通仓库 `data-developer` 已到 `e5a0ec5f`。
- [ ] 同步目标基线并重新读取已合入的中文化/Ponytail 改动，确保本计划仍适用。
- [ ] 运行 `git status --short`，记录并保护所有无关改动。
- [ ] 运行 GitNexus `impact`：
  - `_default_prd_content`
  - `cmd_create`
  - `writeTaskSkeleton`
  - `getBootstrapPrdContent`
  - `getJoinerPrdContent`
  - migration task writer 对应函数
  - 任何计划新增/修改的 generator/checker symbol
- [ ] 若任一结果为 HIGH/CRITICAL，先向用户报告再继续。
- [ ] 运行 `task.py start`；此步骤只能在审批后执行。

## 1. 建立合同与生成器

- [ ] 新增 `packages/cli/src/templates/common/prd-contract.json`，写入双语固定章节、顺序、列表类型、边界、UI 原型门禁和 Mermaid 规范。
- [ ] 新增最小 generator/checker，支持：
  - 正常模式更新受管块；
  - `--check` 模式只比较、不写文件；
  - 错误信息指出 contract key、目标文件和缺失/差异。
- [ ] 在 `package.json` 或 `packages/cli/package.json` 增加 `check:prd-contract`，不改变既有命令默认行为。
- [ ] 为生成块使用稳定 marker，避免重写无关文档内容。

## 2. 默认 PRD 生成路径

- [ ] 先比较：

```bash
diff -u \
  packages/cli/src/templates/trellis/scripts/common/task_store.py \
  .trellis/scripts/common/task_store.py
```

- [ ] 更新 shipped `_default_prd_content()`：
  - `Goal / 目标`
  - `Requirements / 需求`
  - `User-visible Outcomes / 用户可见结果`
  - 固定顺序；
  - Goal 有序列表；
  - Outcome checklist；
  - 删除旧 `Acceptance Criteria / 验收标准` 与 `Notes / 说明` 固定章节。
- [ ] 保留 title、description、locale 与 `--no-start` 等现有行为。
- [ ] 按 dogfood twin 规则同步 `.trellis/scripts/common/task_store.py`，不覆盖不相关 drift。

## 3. Workflow 与 Brainstorm

- [ ] 更新 `packages/cli/src/templates/trellis/workflow.md` 的：
  - Planning Artifacts；
  - Phase 1.1；
  - planning completion/review gate；
  - PRD/design/implement/research 边界；
  - UI 原型审批门禁；
  - Mermaid 使用与红色关键链路规则。
- [ ] 同步 `.trellis/workflow.md` dogfood 副本。
- [ ] 更新 `packages/cli/src/templates/common/skills/brainstorm.md`：
  - exploration 中允许“已确认事实”临时分类；
  - Artifact Rules 只定义最终 PRD 核心章节；
  - convergence gate 与 final summary 使用“用户可见结果”；
  - 技术内容下沉规则；
  - UI 原型确认门禁；
  - Mermaid 规则；
  - PRD convergence pass 不再把 Technical Notes/Acceptance Criteria 当 PRD 归宿。
- [ ] 用当前调用图确认旧 Codex/Copilot brainstorm 文件无消费者后删除或移出事实源；同步修改错误的回归测试文件列表。

## 4. 特殊 PRD 写入器

- [ ] 改造 bootstrap：
  - `prd.md` 只保留开发者可读目标、需求、用户可见结果；
  - Agent 执行步骤与 checklist 进入 `implement.md`。
- [ ] 改造 joiner：
  - `prd.md` 改为新成员可读；
  - runtime mechanics、命令和 suggested opening line 进入 `implement.md`。
- [ ] 改造 migration：
  - `prd.md` 使用核心合同；
  - migration guide、兼容、风险、回滚进入 `design.md`；
  - 命令、验证和 checklist 进入 `implement.md`。
- [ ] 保持特殊 Task 现有 status、assignee、priority、active pointer 和 idempotency 行为。
- [ ] 验证所有 metadata/guide/AI instruction 内容完整迁移，无静默丢失。

## 5. 平台与 Marketplace 传播

- [ ] 从 common Skill 渲染所有平台注册的 `trellis-brainstorm` 输出并比较合同块。
- [ ] 不手工维护平台语义副本；平台差异只保留 frontmatter/placeholder（前言/占位符）格式。
- [ ] 初始化或检出父仓库固定的 Marketplace submodule commit。
- [ ] 同步：
  - `marketplace/workflows/native/workflow.md`
  - `marketplace/workflows/tdd/workflow.md`
  - `marketplace/workflows/channel-driven-subagent-dispatch/workflow.md`
- [ ] Marketplace 自身验证通过后先提交 submodule，再更新父仓库 pointer。

## 6. Bundled Skill 与 docs-site

- [ ] 更新 bundled `trellis-meta` task-system 的 PRD 边界说明。
- [ ] 更新 bundled `trellis-spec-bootstrap` PRD 示例，移走 technical file list/architecture evidence。
- [ ] 在 docs-site pinned baseline 上同步中英文页面：
  - `guides/tasks.mdx`
  - `start/how-it-works.mdx`
  - `start/everyday-use.mdx`
  - `advanced/architecture.mdx`
  - `start/real-world-scenarios.mdx`
- [ ] 更新 `.trellis/spec/docs-site/docs/sync-on-change.md`，新增 PRD contract 变更触发矩阵。
- [ ] 增加当前版本中英文 changelog；不改历史 changelog。
- [ ] docs-site 单独 lint/build 通过后提交 submodule，再更新父仓库 pointer。

## 7. 自动校验与测试矩阵

| # | 场景 | 层级 | 必须验证 |
| --- | --- | --- | --- |
| 1 | 合同 JSON | unit（单元） | schema、locale key、fixed order、list style |
| 2 | 默认 Python renderer | contract | 受管块与合同一致 |
| 3 | Workflow | contract | 章节、顺序、边界、UI 门禁、Mermaid 规范 |
| 4 | Brainstorm | contract | exploration 与 final PRD 分类不混淆 |
| 5 | 全平台 rendered Skill | integration（集成） | 每个平台输出包含同一语义块 |
| 6 | 真实英文 `task.py create` | integration | 实际 `prd.md` 骨架与列表类型 |
| 7 | 真实中文 `task.py create` | integration | 中文标题与英文合同 key 一一对应 |
| 8 | UI Task 规则 | contract | 原型未确认不得 start 的规则同时存在于 Workflow/Skill |
| 9 | 技术边界 | contract | design/implement/research 归属表达完整 |
| 10 | Mermaid | contract | `critical` class + 红色 `linkStyle` + 非颜色文字 |
| 11 | Bootstrap/Joiner | integration | PRD 人读，Agent 步骤在 implement |
| 12 | Migration | integration | PRD/design/implement 拆分且内容无损 |
| 13 | Marketplace 三副本 | cross-repo（跨仓库） | 合同块一致 |
| 14 | docs-site 中英文 | docs | 页面成对、旧核心结构无残留 |
| 15 | 负向变异 | unit | 乱序/缺门禁/旧章节/缺红色规则时 checker 失败 |
| 16 | 历史 Task | compatibility（兼容） | 不改写、不因 `task.py validate` 失败 |
| 17 | modified local template | update integration | 保留/`.new`/force 行为不变 |

建议新增：

- `packages/cli/test/templates/prd-contract.test.ts`
- `packages/cli/test/scripts/task-prd-contract.integration.test.ts`
- 扩展 `packages/cli/test/commands/init.integration.test.ts`
- 扩展 `packages/cli/test/commands/update.integration.test.ts`
- 扩展 `packages/cli/test/templates/trellis.test.ts`

## 8. 验证命令

按由小到大执行：

```bash
pnpm check:prd-contract
pnpm --filter @mindfoldhq/trellis test -- prd-contract
pnpm --filter @mindfoldhq/trellis test -- init.integration
pnpm --filter @mindfoldhq/trellis test -- update.integration
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

真实 create-task smoke test（冒烟测试）必须在 `mktemp -d` 临时仓库运行，分别设置英文/中文 locale，完成后删除临时目录，不在项目 `.trellis/tasks/` 留 probe Task。

docs-site 与 Marketplace 使用各自仓库定义的 lint/build/test 命令；先读其 `AGENTS.md` 和 `package.json` 再执行。

## 9. 下游模板验收

- [ ] `trellis init` 到英文临时项目，读取真实：
  - `.trellis/workflow.md`
  - `.trellis/scripts/common/task_store.py`
  - 平台 `trellis-brainstorm`
- [ ] `trellis init/update --language zh` 到中文临时项目，重复检查。
- [ ] 真实 `task.py create` 后解析 PRD。
- [ ] 对至少一个 UI 示例走 planning summary，验证原型 pending 时规则拒绝 start。
- [ ] `trellis update` 对 pristine 模板自动更新，对 modified 模板走既有冲突保护。
- [ ] grep 旧固定表达：

```bash
rg -n "requirements, constraints, and acceptance criteria|需求、约束、验收标准|## Acceptance Criteria|## 验收标准" \
  packages/cli/src/templates .trellis/workflow.md marketplace docs-site
```

逐条分类为历史 changelog、示例负例或应修复的当前规则，不做盲目全局替换。

## 10. 提交前影响检查

- [ ] 运行：

```bash
gitnexus detect-changes --scope compare --base-ref main
```

- [ ] 若当前 CLI 语法不同，先查 `gitnexus detect-changes --help`，使用等价 compare 模式。
- [ ] 确认只影响 PRD 合同、生成/传播、特殊 writer、相关 docs/tests 和 submodule pointers。
- [ ] `git diff --name-only` 中若出现无关 workspace、历史 Task、dist、backup 或用户文件，停止并定位来源。

## 11. 回滚点

1. 合同/生成器：单独 commit，能独立回滚。
2. 默认 renderer + Workflow + Skill：同一语义 commit。
3. 特殊 writers：独立 commit，出现内容丢失时可回滚而不丢合同。
4. Tests/checker：与对应行为同 commit 或紧邻 commit。
5. Marketplace submodule：先子仓库 commit，父 pointer 独立 commit。
6. docs-site submodule：先子仓库 commit，父 pointer 独立 commit。

用户已于 2026-07-29 明确授权执行上述 commit 与 PR 发布流程。

## 12. 完成条件

- [ ] `prd.md`、`design.md`、`implement.md` 与 `research/evidence.md` 的所有要求均有实现证据。
- [ ] 全部测试矩阵通过。
- [ ] 真实英文/中文 create-task 产物通过。
- [ ] Marketplace 与 docs-site 子模块及父 pointer 同步完成。
- [ ] GitNexus `detect_changes` 只报告预期影响面。
- [ ] 用户审阅最终实现结果后，再进入 finish/commit/archive 流程。

## 13. 当前执行状态（2026-07-29）

### 已完成

- [x] 用户已授权提交、推送并创建目标为 `data-developer` 的父仓库 PR。
- [x] Marketplace PR 已创建：`mindfold-ai/marketplace#12`，commit `8cb91f8`。
- [x] docs-site PR 已创建：`mindfold-ai/docs#29`，commit `60804b5`。
- [x] 用户确认以 `v0.6.9` 记录本次行为；已补充对应中英文 changelog，未修改 docs-site 导航。
- [x] 用户审批规划后，在 `codex/unify-prd-human-readable-contract` 分支以 `data-developer` 为基线运行 `task.py start`。
- [x] 合同 JSON、双语受管块生成器、`--check`、真实中英文 create smoke 与负向变异测试已落地。
- [x] 默认 renderer、Workflow、Brainstorm、Before Dev、Bootstrap、Joiner、Migration、平台渲染、Marketplace、bundled references 与 docs-site 中英文页面已同步。
- [x] 已删除确认无运行时消费者的旧 Codex/Copilot Brainstorm 与 Before Dev 镜像，并修正事实源测试。
- [x] `task.py validate` 保持原有 context manifest 职责，未扩展为 PRD runtime gate。
- [x] `pnpm check:prd-contract`、全量 `pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm build`、docs-site lint 与 `git diff --check` 通过。
- [x] `task.py validate` 通过，`implement.jsonl` 与 `check.jsonl` 各有 7 条真实上下文。

### 待办

- [ ] 用户审阅本轮实现结果。
- [ ] 提交父仓库产品实现与 submodule pointer，推送并创建目标为 `data-developer` 的 draft PR。
- [ ] 上游合并 Marketplace/docs-site PR 后，确认父仓库 submodule pointer 在上游 URL 可获取。
- [ ] 在可刷新到当前 worktree 的 GitNexus 索引上重跑 `detect-changes`；当前索引落后 5 个提交，compare 结果不能作为可靠放行证据。
- [ ] 获得用户后续授权后再进入 finish/commit/archive。

### 阻塞

- [ ] GitNexus 当前只索引普通仓库旧状态，无法准确映射本 worktree 的未提交差异。

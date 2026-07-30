# PRD 三层合同影响面调研

## 结论

三层不一致真实存在，且影响面不止三份文件：

1. 默认 PRD 骨架由 shipped template（发布模板）中的 Python 函数生成，并有仓库 dogfood twin（自用镜像）。
2. Workflow 是独立 Markdown 模板，安装后整体复制到用户项目。
3. Brainstorm 的当前多平台事实来源是 `common/skills/brainstorm.md`；旧 Codex/Copilot 文件仍被回归测试引用，但已不在当前平台生成链路中。
4. `init.ts` 与 `update.ts` 还有 bootstrap、joiner、migration 三类非默认 `prd.md` 写入器，现有内容明显包含 Agent 执行指令和技术细节。
5. `task.py validate` 当前只校验 JSONL context 和记录分支，不读取 PRD，因此不适合直接承担新合同校验。
6. Marketplace 的三份 workflow 是独立副本；docs-site 是独立 submodule（子模块），中英文多页仍描述旧的 constraints/acceptance/out-of-scope 结构。

## 基线差异

- 当前工作目录：`/Users/blank/.codex/worktrees/9b54/Trellis`
- 当前提交：`c94d6fc2`，detached HEAD（游离检出）
- 当前 `task.py create` 实际生成英文 `Goal / Requirements / Acceptance Criteria / Notes`。
- 普通仓库目录 `/Users/blank/wangliang/gitcode/Trellis` 当前 `data-developer` 分支提交 `e5a0ec5f` 已合入中文本地化与 Ponytail 可读性改造，中文骨架为“目标 / 需求 / 验收标准 / 说明”。
- 实施前必须先确认目标基线并吸收 `de76e2da`（中文 PRD 骨架）与 `e5a0ec5f` 之后的现存改进，禁止从本 worktree 的旧模板直接覆盖新分支成果。

## 默认生成链

### 默认骨架

- `packages/cli/src/templates/trellis/scripts/common/task_store.py:197-220`
  - `_default_prd_content()` 直接拼接四个旧章节。
  - `cmd_create()` 调用该函数并写入 `prd.md`。
- `.trellis/scripts/common/task_store.py:197-220`
  - 当前仓库 dogfood twin 与 shipped template 相同。
  - `.trellis/spec/cli/backend/filesystem-safety.md:106-112` 要求 shipped Python 变更前先比较 twin，保持无关本地漂移。
- `packages/cli/src/templates/trellis/index.ts:88-124`
  - `getAllScripts()` 把 `common/task_store.py` 纳入 `trellis init/update` 的脚本模板集合。

GitNexus 在旧 2 个提交的索引上给 `_default_prd_content` 返回 LOW risk，直接调用者只有 `cmd_create`。该结论只说明函数调用半径小，不覆盖文本镜像、文档、特殊写入器和子模块，不能替代当前源码审计。

### Workflow

- `packages/cli/src/templates/trellis/workflow.md:158-164`
  - 把 PRD 描述为 requirements、constraints、acceptance criteria。
- `packages/cli/src/templates/trellis/workflow.md:330-341`
  - Phase 1.1 只要求“requirements and acceptance criteria”。
- `packages/cli/src/commands/update.ts:887-894`
  - `workflow.md` 作为整体 hash-tracked（哈希跟踪）模板更新，不做局部合并。
- `.trellis/workflow.md`
  - 当前仓库 dogfood 副本，实施时需同步。

### Brainstorm Skill

- `packages/cli/src/templates/common/skills/brainstorm.md:122-146`
  - 收敛门禁使用 user outcome、in/out scope、acceptance criteria。
- `packages/cli/src/templates/common/skills/brainstorm.md:137-165`
  - Artifact Rules 又列 goal and user value、confirmed facts、requirements、acceptance criteria、out of scope、open questions。
- `packages/cli/src/templates/common/skills/brainstorm.md:167-180`
  - PRD convergence pass 仍允许 Technical Notes 和 Acceptance Criteria。
- `packages/cli/src/templates/common/index.ts:73-82`
  - `getSkillTemplates()` 扫描 `common/skills/`，这里才是当前单文件 workflow Skill 的读取入口。
- `packages/cli/src/configurators/shared.ts:431-482`
  - `resolveSkills*()` 从 common source 生成各平台 `trellis-brainstorm`。
- `packages/cli/src/configurators/codex.ts:145-163`
  - Codex 把 common skills 写入 `.agents/skills/`。
- `packages/cli/src/configurators/copilot.ts:22-55`
  - Copilot 同样从 common source 生成 `.github/skills/`。

## 已发现的旧镜像与误导性测试

- `packages/cli/src/templates/codex/skills/brainstorm/SKILL.md`
  - `getAllCodexSkills()` 实际只扫描 `codex-skills/`，不扫描 `codex/skills/`。
- `packages/cli/src/templates/copilot/prompts/brainstorm.prompt.md`
  - 当前 Copilot configurator 的 prompts 来自 `resolveCommands()`，Brainstorm 来自 `resolveSkills()`；`getAllPrompts()` 没有当前调用者。
- `packages/cli/test/regression.test.ts:4865-4919`
  - 测试仍把 common、旧 Codex、旧 Copilot 三份文件当作并列事实来源，反而固化了重复。

实施时应先以 import/call evidence（导入/调用证据）确认这两份文件仍无运行时消费者，再删除旧 brainstorm 镜像或从测试矩阵排除；不能继续手工维护三份独立内容。

仓库 `.agents/skills/trellis-meta/references/core/*` 还保留更老的本地历史文件，但当前 upstream bundled source（上游内置源）没有这些路径，现行 `trellis-meta/SKILL.md` 也未路由到它们。它们属于 dogfood 历史残留，不纳入本 Task 的产品修改，除非实施时发现活跃消费者。

## 其他 `prd.md` 写入器

### Bootstrap 与 Joiner

- `packages/cli/src/commands/init.ts:319-339`
  - `writeTaskSkeleton()` 直接写 `task.json + prd.md`。
- `packages/cli/src/commands/init.ts:387-425`
  - bootstrap PRD 明确写着 “The developer does not read this file”，并把状态清单和 Agent 指令放入 PRD。
- `packages/cli/src/commands/init.ts:642-752`
  - joiner PRD 同样是 Agent-facing instructions（面向 Agent 的指令），包含 runtime mechanics（运行机制）、命令和执行步骤。

### Migration

- `packages/cli/src/commands/update.ts:2798-2845`
  - migration task 直接拼接 `Status`、migration guide、AI Assistant Instructions 并写入 `prd.md`。

这些路径不经过 `_default_prd_content()`。若只改默认函数，Trellis 仍会生成违反“PRD 给人看”边界的 PRD，因此它们必须被纳入迁移策略：PRD 留用户目标/需求/可见结果，技术指南与 AI 执行步骤下沉到 `design.md` / `implement.md`。

## `task.py validate` 判断

- `packages/cli/src/templates/trellis/scripts/common/task_context.py:113-154`
  - `cmd_validate()` 的职责和输出标题都是 JSONL Context Files。
  - 只校验 `implement.jsonl`、`check.jsonl` 和记录分支是否仍存在。
  - 不读取 `prd.md`、`workflow.md` 或 Skill。

结论：不应把三层语义一致性硬塞入现有 `task.py validate`。原因：

1. 它是 task-local context validator（任务本地上下文校验器），不是发布模板校验器。
2. 旧 Task、手写 Task、系统 Task 的历史结构不同，直接加硬门禁会造成升级不兼容。
3. UI 原型审批和“技术内容不得进入 PRD”包含语义规则，不能只靠标题扫描可靠判定。

建议新增专门的 source-level contract checker（源码级合同校验器）和 Vitest（测试框架）测试；真实运行 `task.py create` 验证生成骨架。现有 `task.py validate` 保持职责不变。

## 测试现状

- `packages/cli/test/regression.test.ts` 已覆盖 `task.py create` 生命周期、JSONL seed、分支和 active pointer，但没有验证真实生成 PRD 骨架。
- `packages/cli/test/regression.test.ts:4833-4919` 只用 `toContain()` 检查部分 Workflow/Brainstorm 句子，并把旧平台镜像列为事实来源。
- `packages/cli/test/templates/trellis.test.ts` 已有 Workflow 模板和 Marketplace workflow 的跨副本测试，可扩展 PRD 合同检查。
- `packages/cli/test/commands/init.integration.test.ts` 已读取 bootstrap/joiner PRD，适合补充特殊写入器迁移后的产物断言。
- `packages/cli/test/commands/update.integration.test.ts` 适合验证 migration task 新的多工件输出。

## Marketplace 与文档

当前 worktree 的 `docs-site/`、`marketplace/` 未初始化；使用普通仓库已有 submodule object（子模块对象）回读当前 superproject（父仓库）固定版本：

- Marketplace commit：`3a7bff86`
  - `workflows/native/workflow.md`
  - `workflows/tdd/workflow.md`
  - `workflows/channel-driven-subagent-dispatch/workflow.md`
  - 三份都是独立 Workflow 副本，均描述旧 requirements/constraints/acceptance criteria。
- docs-site pinned commit：`1b530128`
  - `guides/tasks.mdx` 与 `zh/guides/tasks.mdx` 仍展示旧 PRD 示例，且把 API endpoints 放入 PRD。
  - `start/how-it-works.mdx`、`zh/start/how-it-works.mdx` 和 `advanced/architecture.mdx`、`zh/advanced/architecture.mdx` 仍把 PRD定义为 requirements/constraints/acceptance/out-of-scope。
  - `start/everyday-use.mdx`、`zh/start/everyday-use.mdx` 与 `start/real-world-scenarios.mdx`、`zh/start/real-world-scenarios.mdx` 还描述旧收敛结构与含技术内容的示例。
- `.trellis/spec/docs-site/docs/sync-on-change.md`
  - 现有矩阵覆盖 phase、platform、task.py command、skill、JSONL 等触发器，但没有“PRD 合同变化”专门触发器；应新增中英文页面与 Marketplace 镜像同步清单。

## 真实影响面分类

### 必改事实来源与运行路径

- PRD 合同的 machine-readable source（机器可读事实源，新建）
- 默认 PRD renderer（渲染器）
- Workflow 模板与仓库 dogfood 副本
- common Brainstorm Skill
- bootstrap/joiner/migration `prd.md` 写入器及相应工件拆分
- 专门一致性 checker 与真实 create-task 测试

### 必核验传播与镜像

- 所有平台由 common Skill 生成的 `trellis-brainstorm`
- `.trellis/scripts/**` dogfood twin
- Marketplace 三个 Workflow
- bundled `trellis-meta` task-system 与 `trellis-spec-bootstrap` 的 PRD 示例
- docs-site 中英文核心页面与 sync matrix

### 不应直接改动

- 历史 Task PRD
- docs-site 历史 changelog 内容
- `.trellis/.template-hashes.json`
- `packages/cli/dist/**` 与 `.trellis/.backup-*/**`
- 无活跃消费者的 dogfood 历史残留，除非实施时取得新证据

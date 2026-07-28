# 研究：Trellis 仓库架构与实现机制（初学者指南）

- **调研问题**：梳理 Trellis 仓库架构，并向初学者说明其实现机制。
- **范围**：内部仓库研究
- **日期**：2026-07-27
- **检查的 revision（修订版本）**：`d68f65c2`（工作区原先已有未提交改动；本文描述当前可见源码，不把这些改动归因于本次研究）

## 1. 先建立一个 30 秒心智模型

Trellis 不是一个常驻服务。它主要由两部分组成：

1. **安装器 / 同步器（TypeScript CLI，命令行工具）**：npm 包 `@mindfoldhq/trellis` 读取仓库内模板，把 `.trellis/` 和各 AI（人工智能）平台适配文件生成到用户项目中；以后用 `trellis update` 做安全同步。
2. **项目内运行时（生成后的 Python / JS / 平台配置）**：AI 会话开始或每轮提问时，平台 hook（钩子）/plugin（插件）读取 `.trellis/workflow.md`、当前 task（任务）、spec（规范）和 journal（日志），把正确上下文送给 AI。任务状态和知识都保存在文件中，不依赖聊天记忆。

可以把它理解为：

```text
packages/cli/src/templates/*       （上游“源代码/模具”）
          │ trellis init/update
          ▼
用户项目中的 .trellis/* + .claude/.cursor/.pi/... （可运行的本地工作流）
          │ hooks / skills / agents / Python scripts
          ▼
AI 每轮获得：当前任务 + 当前阶段 + 相关规范 + 历史背景
```

最重要的边界：**维护 Trellis 本身时改 `packages/cli/src/templates/`；使用 Trellis 的普通项目通常改生成后的 `.trellis/` 和平台目录。**

## 2. Monorepo（单仓库多包）顶层结构

根目录由 `pnpm-workspace.yaml` 管理，只把 `packages/*` 纳入 pnpm workspace。当前有两个发布包：

| 区域 | 作用 | 关键来源 |
|---|---|---|
| `packages/cli/` | `trellis` / `tl` 命令、init/update/uninstall、平台 configurator、模板、channel CLI、mem CLI | `packages/cli/package.json` |
| `packages/core/` | 可复用的零运行时依赖 TypeScript SDK：channel、task、mem | `packages/core/package.json` |
| `docs-site/` | 文档站，Git submodule，不是 pnpm package | `.gitmodules` |
| `marketplace/` | spec / skill / workflow 市场，Git submodule | `.gitmodules` |
| `.trellis/`、`.claude/`、`.pi/` 等 | Trellis 仓库自己 dogfood 后的生成运行时，不是 npm 模板源 | `packages/cli/scripts/copy-templates.js` 的注释明确禁止从这些目录打包模板 |

构建顺序在根 `package.json`：先 build `@mindfoldhq/trellis-core`，再 build CLI。CLI 对 core 使用 `workspace:*` 依赖。CLI 的 TypeScript 编译后，`packages/cli/scripts/copy-templates.js` 再把非 `.ts` 模板和 migration manifests 复制到 `dist/`；npm bin `packages/cli/bin/trellis.js` 最终加载 `dist/cli/index.js`。

## 3. CLI（命令行工具）init / update 主流水线

### 3.1 CLI 入口

`packages/cli/src/cli/index.ts` 使用 Commander 注册：

- `init`：首次生成或补装平台。
- `update`：把新版本模板安全同步到已有项目；仓库没有单独的 `sync` 命令。
- `upgrade`：升级全局 npm CLI。
- `uninstall`：移除 Trellis 管理文件。
- `workflow`：切换原生或 marketplace workflow。
- `mem`：查询本地 AI 会话。
- `channel`：多 agent 协作事件通道。

真正的 bin 入口是 `packages/cli/bin/trellis.js`。

### 3.2 `trellis init` 调用链

核心入口：`packages/cli/src/commands/init.ts:1032` 的 `init()`。

简化流程：

```text
CLI parse flags
  → 防止在 $HOME 误初始化
  → 解析 language、写入模式、开发者名、Python >= 3.9
  → 检测项目类型 / monorepo packages
  → 选择 spec 模板、workflow 模板、AI 平台
  → startRecordingWrites(cwd)
  → createWorkflowStructure(...)
      → 复制 .trellis/scripts/
      → 写 workflow.md / config.yaml / .gitignore
      → 建 workspace/、tasks/、spec/
  → configurePlatform(platform, cwd) 逐个平台生成 hooks/agents/skills/settings
  → 写 AGENTS.md 等根文件和 .trellis/.version
  → stopRecordingWrites()
  → initializeHashes(cwd, { trackedPaths })
  → init_developer.py
  → 新项目创建 bootstrap task；新加入者创建 onboarding task
```

关键代码：

- `.trellis/` 骨架：`packages/cli/src/configurators/workflow.ts:91` `createWorkflowStructure()`。
- 模板目录递归复制：`packages/cli/src/templates/extract.ts` `copyTrellisDir()`。
- 统一写文件和冲突模式：`packages/cli/src/utils/file-writer.ts` `writeFile()`。
- 平台分发：`packages/cli/src/configurators/index.ts` `configurePlatform()`。
- monorepo 检测：`packages/cli/src/utils/project-detector.ts`。
- 远端 spec 模板：`packages/cli/src/utils/template-fetcher.ts`。
- workflow 市场解析：`packages/cli/src/utils/workflow-resolver.ts`。

### 3.3 `trellis update` 调用链

核心入口：`packages/cli/src/commands/update.ts:1697` 的 `update()`。

简化流程：

```text
确认 .trellis/ 存在
  → 比较 project / CLI / npm 版本，阻止意外 downgrade
  → loadHashes()
  → 修复旧 manifest 中无人认领的路径
  → collectTemplateFiles()
      → .trellis scripts/config/workflow
      → AGENTS.md
      → 已配置平台的 collectTemplates()
  → 收集 / 分类 migrations 和 safe deletes
  → analyzeChanges()
  → dry-run 或确认
  → 整体备份 managed directories
  → 执行迁移 / 安全删除
  → 新文件直接写
  → 用户未改的旧模板自动更新
  → 用户改过的文件询问 overwrite / skip / .new
  → 更新 .version 和成功落地文件的 hashes
```

关键代码：

- 模板总聚合：`packages/cli/src/commands/update.ts:621` `collectTemplateFiles()`。
- 变更分类：`packages/cli/src/commands/update.ts:713` `analyzeChanges()`。
- migration 注册与读取：`packages/cli/src/migrations/index.ts`、`packages/cli/src/migrations/manifests/*.json`。
- manifest 自愈：`packages/cli/src/utils/manifest-prune.ts`。

## 4. 模板、configurator 与 hash 如何配合

### 4.1 模板分层

| 模板目录 | 内容 |
|---|---|
| `packages/cli/src/templates/trellis/` | `.trellis/` 主运行时：workflow、config、Python scripts |
| `packages/cli/src/templates/common/` | 跨平台 commands、skills、多文件 bundled skills |
| `packages/cli/src/templates/markdown/` | AGENTS、workspace、默认 spec/guides 模板 |
| `packages/cli/src/templates/{claude,cursor,codex,...}/` | 平台专属 agents、settings、hooks/plugins/extensions |
| `packages/cli/src/templates/shared-hooks/` | 多个平台复用的 Python hooks |

`packages/cli/src/templates/trellis/index.ts` 显式读取并导出 Python scripts / workflow / config；`getAllScripts()` 返回“目标相对路径 → 内容”的 Map。`packages/cli/src/templates/common/index.ts` 扫描 common command/skill 文件；`packages/cli/src/configurators/shared.ts` 再按平台能力解析 `{{CMD_REF:*}}`、`{{PYTHON_CMD}}`、条件块和 frontmatter。

### 4.2 Configurator 是“平台编译器”

平台数据的单一注册表是 `packages/cli/src/types/ai-tools.ts:111` 的 `AI_TOOLS`：它声明平台目录、CLI flag、是否 agent-capable、是否有 hooks、命令引用风格等。行为注册表是 `packages/cli/src/configurators/index.ts` 的 `PLATFORM_FUNCTIONS`。

每个平台有两个必须一致的动作：

1. `configure(cwd)`：init 时真正写文件。
2. `collectTemplates()`：update 时重建同一份“目标路径 → 期望内容” Map。

例如：

- Claude：`packages/cli/src/configurators/claude.ts` 写 `.claude/commands/trellis/`、`.claude/skills/`、agents、shared hooks 和 settings。
- OpenCode：`packages/cli/src/configurators/opencode.ts` 让 init 和 update 共用 `collectOpenCodeTemplates()`，避免两条路径漂移。
- Pi：`packages/cli/src/configurators/pi.ts` 写 prompts、skills、agents、extension 和 settings。

若 configure 与 collect 的文件集或字节不同，刚 init 的文件在下一次 update 就可能被误报为用户修改，因此两者一致是核心不变量。

### 4.3 `.template-hashes.json` 是安全同步账本

实现：`packages/cli/src/utils/template-hash.ts`。

文件位于 `.trellis/.template-hashes.json`，v2 结构为：

```json
{
  "__version": 2,
  "hashes": {
    ".trellis/workflow.md": "<sha256>",
    ".claude/settings.json": "<sha256>"
  }
}
```

契约：

- key 是**用户项目中的落地路径**，统一 POSIX `/`。
- value 是上次 Trellis 成功写入内容的 SHA256，计算前把 CRLF 归一成 LF。
- task、workspace、spec、developer identity 等用户数据不作为普通模板覆盖目标。
- init 通过 `startRecordingWrites()` 只记录本次真正拥有/写入的根文件和平台文件，避免把 `.codex/sessions/` 等用户运行数据误收进 manifest。

update 的判断可记成：

```text
磁盘文件 == 新模板                    → unchanged
磁盘当前 hash == 上次 Trellis hash    → 用户没改；可 auto-update
否则                                  → 用户改过；询问 overwrite/skip/.new
文件不存在但 manifest 有旧 hash       → 视为用户主动删除，不擅自重建
文件不存在且没有旧 hash               → new file
```

这不是 Git 三方合并，但概念上使用“上次模板 hash”作为 base，区分“上游模板变了”和“用户本地改了”。

### 4.4 配置与 i18n 是源选择，不改变落地契约

- 项目配置模板：`packages/cli/src/templates/trellis/config.yaml`。
- TS language reader：`packages/cli/src/utils/i18n.ts`，优先级是 `TRELLIS_LANGUAGE` > `config.yaml` > `en`。
- workflow locale 选择：`packages/cli/src/templates/trellis/index.ts` `getWorkflowTemplate(locale)`。

例如中文源是 `workflow.zh.md`，但仍落地为 `.trellis/workflow.md`，hash key 也仍是 `.trellis/workflow.md`；翻译缺失时回落英文。因此下游 hooks 完全不需要知道源文件后缀。

## 5. 生成后的 `.trellis/` Python 运行时

这些 Python 文件的权威模板在 `packages/cli/src/templates/trellis/scripts/`；`trellis init/update` 会把它们复制到用户项目的 `.trellis/scripts/`。它们只用标准库，要求 Python 3.9+，所以项目不需要安装 Python package。

| 入口 / 模块 | 职责 |
|---|---|
| `task.py` | task 命令路由；start/current/finish/list，CRUD 分给 common modules |
| `common/task_store.py` | create/archive、parent-child、branch/scope 元数据 |
| `common/task_context.py` | implement/check JSONL 的添加、校验和展示 |
| `common/active_task.py` | 解析平台 session identity，在 `.trellis/.runtime/sessions/` 读写当前任务 |
| `get_context.py` + `common/git_context.py` | 输出完整会话、package/spec 或 workflow phase context |
| `common/workflow_phase.py` | 从 `workflow.md` 按 step 提取说明，并过滤平台标记块 |
| `common/config.py` / `common/trellis_config.py` | 无第三方依赖的轻量 YAML 读取；前者给 runtime typed accessors，后者给 hooks 原始 dict |
| `init_developer.py` + `common/developer.py` | 建 `.developer`、个人 workspace、首个 journal/index |
| `add_session.py` | 把一次会话写入 journal，更新 index，按行数轮转并可安全 auto-commit |

### 当前任务为什么按 session 隔离

`common/active_task.py:468` 的 `resolve_active_task()` 从 hook input、平台 session/conversation/transcript id、环境变量或 `TRELLIS_CONTEXT_ID` 推导 context key。`set_active_task()` 把指针写到：

```text
.trellis/.runtime/sessions/<context-key>.json
```

因此两个 AI 窗口可以各自处理不同 task。若拿不到 session identity，Trellis 不写共享的全局指针；只有运行时恰好只有一个 session 文件时，class-2 sub-agent 才允许单一候选 fallback，存在多个候选就拒绝猜测。

## 6. 平台 integrations 与 hooks

### 6.1 所有平台共享语义，不共享宿主 API

Trellis 把平台差异限制在 generated adapter files：Claude 用 settings hooks，Cursor 用 hooks.json，OpenCode 用 JS plugins，Pi 用 extension，其他平台用各自 agents/skills/prompts/workflows。完整平台注册表见 `packages/cli/src/types/ai-tools.ts`，平台落地位置可看 `packages/cli/src/templates/common/bundled-skills/trellis-meta/references/platform-files/platform-map.md`。

三类核心注入：

1. **SessionStart 概览**：`packages/cli/src/templates/shared-hooks/session-start.py` 调 `.trellis/scripts/get_context.py`，注入 developer、git、active task、phase index、packages/spec 等。
2. **每轮 workflow-state breadcrumb**：`packages/cli/src/templates/shared-hooks/inject-workflow-state.py` 解析 `.trellis/workflow.md` 中 `[workflow-state:STATUS]...` 块，按当前 task status 注入下一步提示。workflow.md 是文案单一来源，hook 不内置另一套流程表。
3. **sub-agent context**：
   - push 型平台在 spawn 前运行 `inject-subagent-context.py`，读取 JSONL 指向的 spec/research，再读 `prd.md → design.md（可选）→ implement.md（可选）`。
   - 无法修改 sub-agent prompt 的平台，由 `packages/cli/src/configurators/shared.ts` 的 pull-based prelude 要求 agent 启动后主动读同一组文件。

shared hook 的平台分配表在 `packages/cli/src/templates/shared-hooks/index.ts` 的 `SHARED_HOOKS_BY_PLATFORM`。Claude 的实际注册示例在 `packages/cli/src/templates/claude/settings.json`；Gemini 把每轮事件命名为 `BeforeAgent`，见 `packages/cli/src/templates/gemini/settings.json`。

### 6.2 特殊适配

- **OpenCode**：没有 Python hook 入口的同构行为由 `packages/cli/src/templates/opencode/plugins/session-start.js`、`inject-workflow-state.js` 和 `inject-subagent-context.js` 实现。
- **Pi**：`packages/cli/src/templates/pi/extensions/trellis/index.ts.txt` 是较完整 extension，负责 session identity、context 注入和 subagent 工具/进度 UI；`packages/cli/src/templates/pi/settings.json` 注册它。
- **Codex**：默认 `codex.dispatch_mode: inline`，由主 agent 直接实现/检查；可配置 `sub-agent`。workflow phase 提取和 workflow-state 都会据此选择 `*-inline` 或普通块。

## 7. Task / session / spec / workflow 生命周期

### 7.1 四种持久化各管一件事

| 持久化 | 回答的问题 |
|---|---|
| `.trellis/workflow.md` | “现在应该按什么流程做？”——阶段、门禁、路由、每轮 breadcrumb |
| `.trellis/tasks/<task>/` | “这个具体任务要做什么、做到什么程度？”——task.json、PRD、设计、计划、研究、context manifests |
| `.trellis/spec/` | “以后在这个 package/layer 写代码都必须遵守什么？”——长期工程约定 |
| `.trellis/workspace/<developer>/` | “之前各会话发生过什么？”——journal 和 index |

### 7.2 Task 状态与 workflow 阶段

`task.py create`（实现位于 `common/task_store.py:195`）会：

- 创建 `MM-DD-slug/`。
- 写 canonical 24 字段 `task.json`，初始 `status: planning`。
- 写默认 `prd.md`。
- 对支持 sub-agent 的项目 seed `implement.jsonl` / `check.jsonl`。
- 有 session identity 时自动把新 task 设为当前 task，让下一轮 breadcrumb 进入 planning。

复杂任务在 planning 中补 `design.md` 和 `implement.md`；轻量任务可 PRD-only。JSONL 只登记 spec/research，不代替人可读的执行计划。

用户 review 后，`task.py start`：

- 设置 session-scoped active task。
- 把 `planning → in_progress`。
- 触发 `hooks.after_start`。

执行阶段由 workflow 和平台 skill/agent 驱动 implement → check → update-spec → commit。这里没有单独持久化 `current_phase`；TypeScript SDK 的 `inferTaskPhase()` 也是从 task status 投影。

结束时两个命令含义不同：

- `task.py finish`：只删除当前 session pointer，task status 不自动完成。
- `task.py archive <task>`：写 `completed` / `completedAt`，清理所有指向它的 session 文件，移动到 `.trellis/tasks/archive/YYYY-MM/`，并按配置安全 auto-commit。

`add_session.py` 负责把会话摘要写入 developer journal；journal 超过 `max_journal_lines` 时滚动到下一文件。`session_auto_commit` 可关闭自动 stage/commit。

### 7.3 Spec 如何进入实现

`get_context.py --mode packages` 扫描 `.trellis/config.yaml` 的 package 映射和 `.trellis/spec/<package>/<layer>/`，列出可用入口。规划阶段把相关 `index.md` / 细分规则写进 task 的 `implement.jsonl` 和 `check.jsonl`；sub-agent hook/prelude 再按 manifest 加载。实现/调试产生可复用规则时，Phase 3.3 用 `trellis-update-spec` 沉淀回 spec。

这实现了核心原则：**规范在正确时机注入，而不是赌模型记得。**

## 8. Core SDK

发布包：`@mindfoldhq/trellis-core`，源码在 `packages/core/src/`。它没有 runtime dependencies，ESM + declarations，公开 subpath 是 `./channel`、`./task`、`./mem`、`./testing`。根 barrel `packages/core/src/index.ts` 只重导 channel 和 task；mem 必须显式从 `@mindfoldhq/trellis-core/mem` 引入。

### 8.1 Channel API：本地 event-sourced 多 agent 协作

公开面：`packages/core/src/channel/index.ts`。

- 默认存储根：`~/.trellis/channels/`，可由 `TRELLIS_CHANNEL_ROOT` 覆盖。
- project scope 用 cwd 派生 bucket；也支持 global scope。
- 每个 channel 的真相是 `<bucket>/<channel>/events.jsonl`，并有 `.seq`、lock 和 worker sidecars。
- `createChannel()`、`sendMessage()`、thread/context/title API 都追加 typed event。
- `appendEvent()` 在 channel lock 内分配 seq，并支持 idempotency key。
- reducer 从事件投影 metadata、threads、worker registry，而不是维护另一份可漂移的主状态。
- `watchChannelEvents()` 以 `fs.watch` 唤醒、200ms polling 兜底，返回 AsyncGenerator。
- `spawnWorker()` 不依赖 Claude/Codex 进程细节；调用者注入 `WorkerRuntime`。core 管 durable lifecycle events，CLI adapter 管 provider/process。

CLI 的 `trellis channel ...` 是这套 SDK 的终端适配层，入口在 `packages/cli/src/commands/channel/index.ts`。

### 8.2 Task API：Python 与 TypeScript 的共享契约

公开面：`packages/core/src/task/index.ts`。

- `schema.ts` 定义 canonical 24-field `TrellisTaskRecord`、固定字段顺序、零依赖 parse/safeParse 和 `emptyTaskRecord()`。
- 该 shape 明确镜像生成运行时 `common/task_store.py::cmd_create`。
- `records.ts` 读写 task.json；写入时 canonical 字段在前，并保留磁盘上的未知扩展字段；遇到损坏 JSON 会拒绝覆盖。
- `paths.ts` 校验 `MM-DD-slug` 和系统 onboarding task 目录名。
- `phase.ts` 从 status 推导 plan / implement / review / completed。

CLI 的 `packages/cli/src/utils/task-json.ts` 只是兼容性 re-export；新 Node 消费者应直接引 `@mindfoldhq/trellis-core/task`。

### 8.3 Mem API：本地跨平台会话检索

公开面：`packages/core/src/mem/index.ts`。

它读取本机 Claude Code / Codex（OpenCode reader 当前为降级状态）的持久会话，提供 list、search、context、dialogue extract 和 project summary；CLI `packages/cli/src/commands/mem.ts` 只负责 argv 校验、终端渲染和退出码。mem 不搜索 channel event logs，它是独立的数据源。

## 9. 一个端到端例子：用 Claude Code 完成“添加登录校验”

```text
A. 安装阶段
   用户运行：trellis init --claude -u alice
   CLI → init() → createWorkflowStructure()
       → 生成 .trellis/workflow.md、scripts、spec、workspace、tasks
       → configureClaude() 生成 .claude hooks/agents/skills/settings
       → initializeHashes() 记录 Trellis 管理文件
       → init_developer.py 建 alice 的 journal

B. 新 AI 会话
   Claude SessionStart → .claude/hooks/session-start.py
       → get_context.py 汇总 developer/git/tasks/spec/phase
       → Claude 先知道项目处于什么状态

C. 创建和规划任务
   AI 经用户同意运行 task.py create "Add login validation" --slug login-validation
       → .trellis/tasks/07-27-login-validation/
       → task.json(status=planning) + prd.md + implement/check.jsonl
       → session pointer 写入 .trellis/.runtime/sessions/<claude-session>.json
   每轮 UserPromptSubmit hook 从 workflow.md 的 planning block 注入“留在规划阶段”。
   AI 完成 PRD；复杂时再写 design.md / implement.md，并把 auth spec 加入 JSONL。

D. 开始实现
   用户 review 后运行 task.py start login-validation
       → status 变 in_progress
   主 agent dispatch trellis-implement
       → PreToolUse hook 把 JSONL spec/research + PRD/design/plan 注入 sub-agent
   implement 完成后，trellis-check 用 check.jsonl 和同一 task artifacts 验证。

E. 沉淀和结束
   新发现的长期认证约束写回 .trellis/spec/
   代码 commit 后运行 finish-work 流程
       → task.py archive 把 task 标 completed、移动到 archive/YYYY-MM/，并清除 active pointer
       → add_session.py 把本次工作写入 alice journal

F. 上游 Trellis 升级
   用户安装新 CLI 后运行 trellis update
       → collectTemplateFiles() 重建最新 Claude/.trellis 期望内容
       → hashes 证明未手改的 hooks 自动升级
       → 用户改过的 workflow/skill 不会被静默覆盖，而是提示选择
```

这个例子串起了全部核心机制：**CLI 生成 → hook 注入 → task 文件持久化 → spec 定向加载 → sub-agent 执行 → journal 记忆 → hash 安全升级**。

## 10. 初学者查代码的最短路径

| 想理解的问题 | 先读 |
|---|---|
| 命令从哪里进 | `packages/cli/src/cli/index.ts` |
| init 到底生成什么 | `packages/cli/src/commands/init.ts`、`packages/cli/src/configurators/workflow.ts` |
| update 为什么不覆盖我的修改 | `packages/cli/src/commands/update.ts`、`packages/cli/src/utils/template-hash.ts` |
| 某平台文件怎么生成 | `packages/cli/src/types/ai-tools.ts` → `packages/cli/src/configurators/<platform>.ts` → `packages/cli/src/templates/<platform>/` |
| workflow 为什么每轮提醒 AI | `packages/cli/src/templates/trellis/workflow.md`、`packages/cli/src/templates/shared-hooks/inject-workflow-state.py` |
| 当前 task 为什么是 session-scoped | `packages/cli/src/templates/trellis/scripts/common/active_task.py` |
| task 文件怎么创建/归档 | `packages/cli/src/templates/trellis/scripts/common/task_store.py` |
| spec 怎么送进 sub-agent | `packages/cli/src/templates/shared-hooks/inject-subagent-context.py`、`packages/cli/src/configurators/shared.ts` |
| channel SDK 怎么工作 | `packages/core/src/channel/index.ts`、`packages/core/src/channel/internal/store/events.ts` |
| task SDK 契约在哪里 | `packages/core/src/task/schema.ts` |
| mem 与 CLI 如何分层 | `packages/core/src/mem/index.ts`、`packages/cli/src/commands/mem.ts` |

## Caveats

- 仓库当前没有 `trellis sync` 命令；用户口语中的“sync”实际对应首次 `init` 和后续 `update`。
- `.trellis/` 是本仓库 dogfood 后的运行实例；上游模板权威源仍是 `packages/cli/src/templates/`。
- docs-site 和 marketplace 是 submodules，虽然在 Trellis config 中可作为 packages 管理，但不属于根 pnpm workspace 的 `packages/*`。
- platform host API 不统一，所以“相同 Trellis 语义”可能由 Python hook、JS plugin、extension 或 agent prelude 实现，不能只改一份 hook 就假定所有平台同步。

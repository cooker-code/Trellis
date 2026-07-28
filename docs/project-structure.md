# Trellis 项目目录与关键文件说明

本文档说明 Trellis 仓库中各目录的职责、关键文件、主要执行流程，以及源码、生成物和运行数据之间的边界。它面向需要阅读、维护或二次开发 Trellis 的贡献者。

## 1. 阅读范围与约定

- 本文以 2026-07-28 的仓库结构为基准。
- “目录”按职责说明。大量结构相同的动态目录使用路径模式表示，例如 `.trellis/tasks/archive/<year-month>/<task>/`；模式覆盖该集合中的每个实例。
- “关键文件”指入口、配置、公开 API（应用程序编程接口）、构建、发布、测试或数据契约文件，不逐一列出图片、测试夹具和同构的语言副本。
- `docs-site/` 和 `marketplace/` 是独立 Git submodule（Git 子模块），本文只说明它们在主仓库中的边界。
- `.git/`、`node_modules/`、`dist/`、`.gitnexus/` 和 `.trellis/.runtime/` 等本地或生成目录不属于手工维护的源代码，单独在“生成物与本地状态”一节说明。

## 2. 先建立整体心智模型

Trellis 不是常驻服务，主要由两部分组成：

1. `packages/cli/` 提供 npm 命令行工具，负责 `init`（初始化）、`update`（更新）、`workflow`（工作流）、`mem`（会话记忆）、`channel`（多智能体通道）等命令。
2. `packages/cli/src/templates/` 中的模板被写入用户项目，形成 `.trellis/` 与各 AI（人工智能）平台目录中的项目内运行时。

`packages/core/` 提供可独立复用的 TypeScript SDK（软件开发工具包），封装 channel、mem 和 task 等领域能力。

```text
packages/cli/bin/trellis.js
        │
        ▼
packages/cli/src/cli/index.ts
        │
        ├── commands/        解析并执行 CLI 命令
        ├── configurators/   把统一能力映射到不同 AI 平台
        ├── templates/       模板源文件
        └── utils/           文件、版本、路径、同步与安全工具
                │
                │ trellis init / trellis update
                ▼
用户项目中的 .trellis/ + .claude/.codex/.cursor/...
                │
                └── hooks / plugins / skills / agents 注入任务、规范和历史上下文

packages/core/
        └── 向 CLI 和其他 Node.js 程序提供 channel、mem、task 公共 API
```

构建顺序由根 `package.json` 固定为先构建 `@mindfoldhq/trellis-core`，再构建 `@mindfoldhq/trellis`。

## 3. 根目录总览

| 路径 | 类型 | 职责 |
| --- | --- | --- |
| `.agents/` | 平台运行文件 | Codex 等平台可发现的共享 Skills（技能）目录，也是多平台 Skill 的公共落地点。 |
| `.claude/` | 平台运行文件 | Claude Code 的 agents（智能体）、commands（命令）、hooks（钩子）、skills 和设置。 |
| `.codex/` | 平台运行文件 | Codex 的 agents、hooks、skills 和项目配置。 |
| `.cursor/` | 平台运行文件 | Cursor 的 agents、commands、hooks、skills 和 hook 配置。 |
| `.github/` | 仓库治理 | GitHub Issue（问题）模板和 CI/CD（持续集成/持续交付）工作流。 |
| `.husky/` | Git hook | 提交前执行 lint-staged（暂存文件检查）。 |
| `.omp/` | 平台运行文件 | Oh My Pi 的 agents、commands、extensions（扩展）和 skills。 |
| `.opencode/` | 平台运行文件 | OpenCode 的 agents、commands、JavaScript 插件、辅助库和 skills。 |
| `.pi/` | 平台运行文件 | Pi Agent 的 agents、extensions、prompts（提示词）、skills 和设置。 |
| `.trellis/` | 项目内运行时 | Trellis 自身的工作流、任务、规范、脚本、智能体定义和团队工作日志。 |
| `assets/` | 静态资源 | README、社区说明和宣传材料使用的图片、GIF（动图）与二维码。 |
| `docs/` | 仓库说明 | 面向本仓库贡献者的结构与维护说明；本文档位于此处。 |
| `docs-site/` | Git 子模块 | 面向最终用户的 Mintlify 文档站，独立版本管理。 |
| `drafts/` | 草稿 | 尚未作为正式文档或公告发布的论坛文章等内容。 |
| `marketplace/` | Git 子模块 | 工作流、Skill、Spec（规范）等可安装内容的市场仓库。 |
| `packages/` | 产品源码 | pnpm workspace（工作区）中的 CLI 与 Core 两个发布包。 |

### 3.1 根目录关键文件

| 文件 | 职责 |
| --- | --- |
| `README.md` | 英文项目首页、安装入口、工作原理和社区链接。 |
| `README_CN.md` | 中文项目首页。 |
| `AGENTS.md` | 通用智能体的项目级约束；包含 Trellis 托管区块和 GitNexus 代码分析要求。 |
| `CLAUDE.md` | Claude Code 的项目入口说明。 |
| `CONTRIBUTING.md` | 英文贡献指南。 |
| `CONTRIBUTING_CN.md` | 中文贡献指南。 |
| `LICENSE` | 主仓库 AGPL-3.0-only 许可证全文。 |
| `COPYRIGHT` | 项目版权声明。 |
| `package.json` | monorepo（单仓库多包）的根脚本；统一编排 build、test、lint、typecheck 和 release。 |
| `pnpm-workspace.yaml` | pnpm 工作区范围，目前包含 `packages/*`。 |
| `pnpm-lock.yaml` | 锁定整个工作区的依赖版本。 |
| `pyrightconfig.json` | Python 静态类型检查配置，主要用于模板内的 Python 运行时。 |
| `.gitmodules` | 声明 `docs-site` 与 `marketplace` 两个 Git 子模块。 |
| `.gitignore` | 根仓库忽略规则。 |
| `.gitattributes` | Git 文本、换行符及文件属性规则。 |
| `.lintstagedrc` | lint-staged 对暂存文件执行的检查规则。 |

## 4. `packages/`：发布包

`pnpm-workspace.yaml` 将 `packages/*` 纳入工作区。当前只有两个发布包。

### 4.1 `packages/cli/`

npm 包名为 `@mindfoldhq/trellis`，同时暴露 `trellis` 和 `tl` 两个命令。它负责用户交互、模板安装、更新、迁移、平台适配和发布。

| 路径 | 职责 |
| --- | --- |
| `packages/cli/bin/` | npm 可执行入口。 |
| `packages/cli/scripts/` | 构建后复制模板、版本升级、发布预检、变更清单生成和一致性检查脚本。 |
| `packages/cli/src/` | CLI TypeScript 源码。 |
| `packages/cli/test/` | CLI 单元、集成和回归测试。目录结构大体与 `src/` 对齐。 |
| `packages/cli/dist/` | TypeScript 编译和模板复制后的发布产物，不应手工修改。 |
| `packages/cli/node_modules/` | 本地依赖安装目录，不进入版本控制。 |

#### 4.1.1 `packages/cli/src/`

| 路径 | 职责 |
| --- | --- |
| `packages/cli/src/cli/` | Commander 命令注册、参数解析、版本提示和顶层错误处理。 |
| `packages/cli/src/commands/` | 各 CLI 命令的业务实现。 |
| `packages/cli/src/commands/channel/` | 多智能体 channel 命令、运行时适配、事件存储和 supervisor（监督器）。 |
| `packages/cli/src/commands/channel/adapters/` | Claude、Codex、OpenCode、Pi、Qoder 等 worker（工作智能体）的输入输出适配器。 |
| `packages/cli/src/commands/channel/store/` | channel 事件、线程、收件箱、锁、元数据和路径的文件存储层。 |
| `packages/cli/src/commands/channel/supervisor/` | worker 进程、inbox（收件箱）监听、状态维护和生命周期控制。 |
| `packages/cli/src/configurators/` | 把统一的 Trellis 模板和能力转换成各 AI 平台的目录、配置与 hook。 |
| `packages/cli/src/constants/` | 版本、路径、平台名等共享常量。 |
| `packages/cli/src/migrations/` | Trellis 更新时的文件迁移定义和执行逻辑。 |
| `packages/cli/src/migrations/manifests/` | 按版本声明 rename、delete 等迁移动作的 JSON 清单。 |
| `packages/cli/src/templates/` | 所有项目落地文件的权威模板源。 |
| `packages/cli/src/types/` | 平台注册表和迁移等共享类型。 |
| `packages/cli/src/utils/` | 原子写入、路径归一化、模板 hash、项目检测、代理、注册表、卸载清理等工具。 |

#### 4.1.2 `packages/cli/src/commands/`

| 文件或目录 | 职责 |
| --- | --- |
| `init.ts` | `trellis init` 主流程：检查环境、识别项目、创建 `.trellis/`、配置平台、初始化 hash 和开发者身份。 |
| `update.ts` | `trellis update` 主流程：收集期望模板、比较 hash、备份、迁移，并安全处理本地修改。 |
| `upgrade.ts` | 升级全局安装的 Trellis CLI。 |
| `uninstall.ts` | 按所有权和 manifest（清单）安全移除 Trellis 管理的文件。 |
| `workflow.ts` | 列出、解析和切换本地或 marketplace 工作流。 |
| `mem.ts` | 查询 Claude、Codex、OpenCode、Pi 等平台的历史会话。 |
| `channel/index.ts` | 注册 `trellis channel` 子命令。 |
| `channel/create.ts` | 创建 channel。 |
| `channel/spawn.ts` | 创建并启动 worker。 |
| `channel/send.ts`、`channel/post-thread.ts` | 向 worker 或线程写入消息。 |
| `channel/watch.ts`、`channel/read.ts` | 读取或持续监听 channel 事件。 |
| `channel/supervisor.ts` | 监督 worker 进程及其状态。 |

#### 4.1.3 `packages/cli/src/configurators/`

Configurator（配置器）可以理解为“平台编译器”：它把统一的命令、Skill、agent 和 hook 模板转换成宿主平台要求的文件布局。

| 文件或模式 | 职责 |
| --- | --- |
| `index.ts` | `PLATFORM_FUNCTIONS` 行为注册表；统一分发 `configure()` 与 `collectTemplates()`。 |
| `shared.ts` | 多平台共用的模板解析、占位符替换、Skill/command 写入和 pull-based（拉取式）上下文前导。 |
| `workflow.ts` | 创建 `.trellis/` 骨架、默认 Spec 和工作区。 |
| `claude.ts` | Claude Code 文件布局与设置。 |
| `codex.ts` | Codex agents、hooks、skills 和配置。 |
| `cursor.ts` | Cursor agents、commands、hooks 和 skills。 |
| `opencode.ts` | OpenCode agents、plugins、commands 和 skills。 |
| `pi.ts`、`omp.ts` | Pi Agent 与 Oh My Pi 的扩展和相关文件。 |
| `copilot.ts` | GitHub Copilot 的 hooks、prompts 和 instructions。 |
| `gemini.ts`、`kiro.ts`、`qoder.ts`、`trae.ts` | 对应平台的 agents、hooks、settings 或 commands。 |
| `antigravity.ts`、`codebuddy.ts`、`devin.ts`、`droid.ts`、`grok.ts`、`kilo.ts`、`kimi.ts`、`reasonix.ts`、`snow.ts`、`zcode.ts` | 其他支持平台的专用映射。 |

添加平台时，至少需要同步维护：

1. `src/types/ai-tools.ts` 中的平台数据注册；
2. `src/configurators/index.ts` 中的平台行为注册；
3. 对应 configurator；
4. 对应模板目录；
5. init/update 一致性与回归测试。

#### 4.1.4 `packages/cli/src/templates/`

| 路径 | 职责 |
| --- | --- |
| `templates/common/` | 跨平台共享的 commands、skills、agent preludes（智能体前导）和 bundled skills（内置技能）。 |
| `templates/common/commands/` | `start`、`continue`、`finish-work` 等通用命令模板。 |
| `templates/common/skills/` | before-dev、brainstorm、break-loop、check、update-spec 等单文件 Skill 模板。 |
| `templates/common/bundled-skills/` | 自带 references 的多文件 Skill，如 `trellis-meta`、`trellis-channel`、`trellis-session-insight`。 |
| `templates/common/agent-preludes/` | sub-agent（子智能体）启动时的 push/pull 上下文前导。 |
| `templates/trellis/` | 用户项目中 `.trellis/` 的权威模板。 |
| `templates/trellis/agents/` | 项目内 implement/check 等 agent 说明。 |
| `templates/trellis/scripts/` | 复制到用户项目的 Python 标准库运行时。 |
| `templates/trellis/scripts/common/` | 任务、配置、Git、开发者、上下文和安全提交等共享 Python 模块。 |
| `templates/trellis/scripts/common/i18n_strings/` | Python 运行时的英文/中文消息表。 |
| `templates/trellis/scripts/hooks/` | task 生命周期可调用的项目内 hook 模板。 |
| `templates/trellis/tasks/` | 空任务目录占位。 |
| `templates/markdown/` | `AGENTS.md`、workspace、默认 backend/frontend/guides Spec 模板。 |
| `templates/shared-hooks/` | 跨平台共享的 session-start、workflow-state 和 sub-agent context Python hooks。 |
| `templates/<platform>/` | Claude、Codex、Cursor、OpenCode、Pi 等平台的专属 agents、hooks、plugins、prompts、settings 或 extensions。 |
| `templates/extract.ts` | 递归提取和复制 `.trellis/` 模板。 |
| `templates/template-utils.ts` | 创建模板读取器、扫描平台模板。 |

`templates/<platform>/` 当前包括：

| 目录 | 主要落地产物 |
| --- | --- |
| `claude/` | agents、settings；共享 hooks 由 configurator 合并。 |
| `codex/` | agents、hooks、skills、config。 |
| `cursor/` | agents、hooks。 |
| `opencode/` | agents、plugins、lib 和 package metadata。 |
| `pi/`、`omp/` | agents、extensions、settings。 |
| `copilot/` | instructions、hooks、prompts。 |
| `gemini/`、`kiro/`、`qoder/`、`trae/`、`snow/` | agents、hooks/settings 或宿主配置。 |
| `codebuddy/`、`droid/`、`grok/`、`kimi/`、`reasonix/`、`zcode/` | agents/skills 和平台设置。 |

关键模板文件：

| 文件 | 职责 |
| --- | --- |
| `templates/trellis/index.ts` | 读取并导出 workflow、config、Python scripts 等 `.trellis/` 模板。 |
| `templates/trellis/workflow.md` | 英文原生工作流模板。 |
| `templates/trellis/workflow.zh.md` | 中文原生工作流模板。 |
| `templates/trellis/config.yaml` | 新项目的 Trellis 配置模板。 |
| `templates/common/index.ts` | 聚合通用 commands 和 skills。 |
| `templates/shared-hooks/index.ts` | 定义各平台安装哪些共享 hooks。 |
| `templates/opencode/plugins/*.js` | OpenCode 中与 Python hooks 同构的 JavaScript 插件实现。 |
| `templates/pi/extensions/trellis/index.ts.txt` | Pi Agent 的 Trellis 扩展源模板。 |

#### 4.1.5 `packages/cli/src/utils/`

| 文件 | 职责 |
| --- | --- |
| `file-writer.ts` | 统一写文件、处理覆盖/跳过/新副本策略，并记录 Trellis 实际写入路径。 |
| `atomic-write.ts` | 通过临时文件和替换实现原子写入。 |
| `template-hash.ts` | 维护 `.trellis/.template-hashes.json`，区分上游变化和用户本地修改。 |
| `manifest-prune.ts` | 清理历史 manifest 中不再受 Trellis 管理的路径。 |
| `posix.ts` | 将跨平台持久化路径统一为 POSIX `/` 格式。 |
| `project-detector.ts` | 检测单包、monorepo 和 package 结构。 |
| `template-fetcher.ts` | 获取远程 Spec 模板或 registry（注册表）内容。 |
| `workflow-resolver.ts` | 解析内置或 marketplace 工作流。 |
| `registry-config.ts` | 读取与维护模板/marketplace registry 配置。 |
| `task-json.ts` | TypeScript 侧 task.json 解析与验证。 |
| `uninstall-scrubbers.ts` | 清理共享配置中的 Trellis 托管片段，而非粗暴删除整个用户文件。 |
| `cwd-guard.ts` | 防止在危险或错误目录执行初始化。 |
| `i18n.ts` | 解析语言配置并执行英文回退。 |
| `proxy.ts` | 网络请求的代理环境处理。 |

#### 4.1.6 `packages/cli/scripts/`

| 文件 | 职责 |
| --- | --- |
| `copy-templates.js` | 构建后把非 TypeScript 模板和 migration manifests 复制到 `dist/`。 |
| `release.js` | 执行版本发布流程。 |
| `release-preflight.js` | 检查包版本和计算发布计划。 |
| `bump-versions.js` | 同步更新工作区包版本。 |
| `create-manifest.js` | 生成版本迁移 manifest 与相应变更日志资料。 |
| `check-manifest-continuity.js` | 检查迁移版本连续性。 |
| `check-i18n-drift.js` | 检查英文与中文模板是否发生漂移。 |
| `check-docs-changelog.js` | 检查发布版本是否有匹配的文档站 changelog（变更日志）。 |
| `migrate-features-to-tasks.sh` | 历史数据迁移辅助脚本。 |

#### 4.1.7 `packages/cli/test/`

| 路径 | 职责 |
| --- | --- |
| `packages/cli/test/commands/` | init、update、uninstall、workflow、mem、channel 等命令测试。 |
| `packages/cli/test/configurators/` | 各平台文件生成和注册表一致性测试。 |
| `packages/cli/test/constants/` | 常量契约测试。 |
| `packages/cli/test/migrations/` | 迁移 manifest 和迁移执行测试。 |
| `packages/cli/test/scripts/` | 发布、i18n 和 Python 运行时测试。 |
| `packages/cli/test/templates/` | 模板内容、平台布局和双语回退测试。 |
| `packages/cli/test/types/` | 平台/迁移类型与注册数据测试。 |
| `packages/cli/test/utils/` | 文件写入、hash、路径、安全删除等工具测试。 |
| `packages/cli/test/registry-invariants.test.ts` | 平台数据注册与行为注册之间的不变量。 |
| `packages/cli/test/regression.test.ts` | 跨模块历史回归测试。 |
| `packages/cli/test/setup.ts` | Vitest 公共测试初始化。 |

#### 4.1.8 `packages/cli/` 关键配置

| 文件 | 职责 |
| --- | --- |
| `package.json` | CLI 包元数据、命令入口、依赖、构建/测试/发布脚本。 |
| `bin/trellis.js` | npm bin（可执行文件）入口，加载编译后的 CLI。 |
| `tsconfig.json` | TypeScript 编译配置。 |
| `eslint.config.js` | ESLint 静态检查配置。 |
| `vitest.config.ts` | Vitest 测试配置。 |
| `.prettierrc`、`.prettierignore` | Prettier 格式化规则及忽略项。 |
| `.npmrc` | CLI 包发布或依赖解析相关的 npm 配置。 |

### 4.2 `packages/core/`

npm 包名为 `@mindfoldhq/trellis-core`。它不负责命令行交互，而是向 CLI 和下游 Node.js 程序提供可复用领域 API。

| 路径 | 职责 |
| --- | --- |
| `packages/core/src/` | Core SDK TypeScript 源码。 |
| `packages/core/test/` | SDK 单元和集成测试。 |
| `packages/core/dist/` | 编译产物，不手工修改。 |
| `packages/core/node_modules/` | 本地依赖，不进入版本控制。 |

#### 4.2.1 `packages/core/src/`

| 路径 | 职责 |
| --- | --- |
| `packages/core/src/channel/` | 多智能体通道的公共 API 与文件存储实现。 |
| `packages/core/src/channel/api/` | create、spawn、send、read、watch、interrupt、inbox、workers 等高层调用。 |
| `packages/core/src/channel/internal/` | channel 内部实现，不作为首选公共入口。 |
| `packages/core/src/channel/internal/store/` | channel 元数据、事件、inbox、锁、序号、线程状态、worker 状态和文件监听。 |
| `packages/core/src/mem/` | 跨 AI 平台会话枚举、筛选、搜索、上下文切片和阶段提取。 |
| `packages/core/src/mem/adapters/` | Claude、Codex、OpenCode、Pi、ZCode 的会话格式适配器。 |
| `packages/core/src/mem/internal/` | JSONL（逐行 JSON）、路径和只读 SQLite 访问。 |
| `packages/core/src/task/` | task 路径、状态阶段、schema（结构定义）和记录读取。 |
| `packages/core/src/testing/` | 下游测试可复用的辅助 API。 |

#### 4.2.2 `packages/core/src/` 关键文件

| 文件 | 职责 |
| --- | --- |
| `src/index.ts` | 根导出入口，转发 channel 和 task 公共 API。 |
| `src/channel/index.ts` | `@mindfoldhq/trellis-core/channel` 子路径导出。 |
| `src/channel/api/types.ts` | channel 公共请求、事件和状态类型。 |
| `src/channel/internal/store/schema.ts` | channel 文件存储结构和数据契约。 |
| `src/channel/internal/store/paths.ts` | channel 项目、线程、worker 和 inbox 的路径解析。 |
| `src/mem/index.ts` | `mem` 模块公共导出。 |
| `src/mem/types.ts` | 跨平台会话、消息和搜索结果类型。 |
| `src/mem/sessions.ts` | 会话枚举与读取。 |
| `src/mem/search.ts` | 历史会话搜索。 |
| `src/task/index.ts` | `@mindfoldhq/trellis-core/task` 子路径导出。 |
| `src/task/schema.ts` | task.json 的 schema 和验证契约。 |
| `src/task/phase.ts` | 从任务状态推导工作流阶段。 |
| `src/testing/index.ts` | 测试辅助导出入口。 |

#### 4.2.3 `packages/core/test/`

| 路径 | 职责 |
| --- | --- |
| `packages/core/test/channel/` | channel API、事件存储、锁、监听与 worker 行为测试。 |
| `packages/core/test/mem/` | 各平台会话适配、筛选和搜索测试。 |
| `packages/core/test/task/` | task schema、路径、状态和记录测试。 |

#### 4.2.4 `packages/core/` 关键配置

| 文件 | 职责 |
| --- | --- |
| `package.json` | SDK 包入口、子路径 exports、发布范围和脚本。 |
| `tsconfig.json` | TypeScript 编译配置。 |
| `eslint.config.js` | 静态检查配置。 |
| `vitest.config.ts` | 测试配置。 |

## 5. `.trellis/`：仓库自己的项目内运行时

此目录是 Trellis 对自身使用 Trellis 的结果。它用于当前仓库的开发流程，不是 npm 包内模板的权威源；模板权威源位于 `packages/cli/src/templates/trellis/`。

| 路径 | 职责 |
| --- | --- |
| `.trellis/agents/` | 项目内 architect、plan、research、implement、check 角色说明。 |
| `.trellis/scripts/` | 当前仓库直接执行的 Python 运行时。 |
| `.trellis/scripts/common/` | task、配置、Git、上下文、开发者、路径和安全提交等共享模块。 |
| `.trellis/scripts/common/i18n_strings/` | Python CLI 的中英文文案表。 |
| `.trellis/scripts/hooks/` | task 生命周期 hook。 |
| `.trellis/spec/` | 当前仓库长期有效的工程规范。 |
| `.trellis/spec/cli/backend/` | CLI 后端、命令、模板同步、文件安全和发布规范。 |
| `.trellis/spec/cli/unit-test/` | CLI 测试约定、mock（模拟）与集成测试模式。 |
| `.trellis/spec/core/backend/` | Core SDK 规范入口。 |
| `.trellis/spec/docs-site/docs/` | Mintlify 文档站写作、目录、配置、同步和发布规范。 |
| `.trellis/spec/guides/` | 跨层、复用和跨平台思考指南。 |
| `.trellis/spec/tech/repo/` | monorepo package 与 Spec 路由映射。 |
| `.trellis/tasks/` | 进行中或尚未归档的任务目录。 |
| `.trellis/tasks/<MM-DD-slug>/` | 单个活动任务，存放 task.json、PRD、设计、实施计划、研究和上下文清单。 |
| `.trellis/tasks/<task>/research/` | 任务相关研究证据。 |
| `.trellis/tasks/archive/<year-month>/` | 按年月组织的已归档任务。 |
| `.trellis/tasks/archive/<year-month>/<task>/` | 单个历史任务；文件契约与活动任务相同。 |
| `.trellis/workspace/` | 所有开发者的持久化会话日志。 |
| `.trellis/workspace/<developer>/` | 单个开发者的 journal 和索引。 |
| `.trellis/.runtime/` | session-scoped（会话级）当前任务指针与更新检查标记，本地运行状态。 |

### 5.1 `.trellis/` 关键文件

| 文件 | 职责 |
| --- | --- |
| `.trellis/workflow.md` | 当前仓库开发阶段、门禁和 per-turn breadcrumb（每轮面包屑提示）的单一来源。 |
| `.trellis/config.yaml` | package、默认包、平台行为、hook、更新和语言配置。 |
| `.trellis/.version` | 当前项目内 Trellis 模板版本。 |
| `.trellis/.template-hashes.json` | Trellis 上次成功写入内容的路径与 SHA-256 hash（哈希）账本。 |
| `.trellis/.developer` | 当前本地开发者身份，通常不提交。 |
| `.trellis/.gitignore` | `.trellis/` 内的运行数据忽略规则。 |
| `.trellis/scripts/task.py` | task create/start/current/finish/archive/list 等命令入口。 |
| `.trellis/scripts/get_context.py` | 输出会话、package/Spec 和 workflow phase 上下文。 |
| `.trellis/scripts/init_developer.py` | 初始化开发者身份与 workspace。 |
| `.trellis/scripts/add_session.py` | 将会话摘要写入开发者 journal。 |
| `.trellis/scripts/common/active_task.py` | 按平台 session identity 解析和存储当前任务。 |
| `.trellis/scripts/common/task_store.py` | 创建、归档和维护 task 元数据。 |
| `.trellis/scripts/common/task_context.py` | 维护 implement/check JSONL 上下文清单。 |
| `.trellis/scripts/common/packages_context.py` | 根据 config 和 Spec 目录生成 package 上下文。 |
| `.trellis/workspace/index.md` | 团队工作区索引。 |

### 5.2 单个 task 目录的文件契约

| 文件或目录 | 职责 |
| --- | --- |
| `task.json` | 状态、package、scope（范围）、分支、父子关系等机器可读元数据。 |
| `prd.md` | 需求、范围、约束与验收标准。 |
| `design.md` | 复杂任务的技术设计、边界与权衡。 |
| `implement.md` | 有序执行计划和验证方法。 |
| `implement.jsonl` | implement agent 需要读取的 Spec/研究路径清单。 |
| `check.jsonl` | check agent 需要读取的 Spec/研究路径清单。 |
| `research/` | 调研报告、外部证据和实现前分析。 |
| `acceptance-report.md` | 如果项目流程要求，记录最终验收证据。 |

## 6. AI 平台运行目录

这些目录是 Trellis 仓库自身使用多平台时的落地产物。修改平台能力时，应先改 `packages/cli/src/templates/<platform>/` 与 configurator，再通过初始化/更新流程同步；不要只改根目录生成副本。

### 6.1 `.agents/`

| 路径 | 职责 |
| --- | --- |
| `.agents/skills/` | 多平台或 Codex 可发现的 Skill 根目录。 |
| `.agents/skills/<skill>/SKILL.md` | Skill 入口与触发规则。 |
| `.agents/skills/<skill>/references/` | Skill 按需读取的详细参考。 |

这里包含 Trellis 工作流 Skills，也包含 `python-design`、`ts-sdk-author` 等贡献辅助 Skills。

### 6.2 `.claude/`

| 路径或文件 | 职责 |
| --- | --- |
| `.claude/agents/` | implement、research、check 子智能体定义。 |
| `.claude/commands/trellis/` | `/trellis:*` 命令。 |
| `.claude/hooks/` | session start、workflow-state、sub-agent context 注入脚本。 |
| `.claude/skills/` | Claude Code 可发现的 Skills。 |
| `.claude/settings.json` | 注册 hooks、权限和其他 Claude Code 项目设置。 |

### 6.3 `.codex/`

| 路径或文件 | 职责 |
| --- | --- |
| `.codex/agents/` | Codex TOML 格式的 implement、research、check 智能体。 |
| `.codex/hooks/` | session start 与 workflow-state hooks。 |
| `.codex/skills/` | Codex 专用 Skills，例如 release manifest 创建。 |
| `.codex/config.toml` | Codex 项目配置。 |
| `.codex/hooks.json` | Codex hook 注册表。 |

### 6.4 `.cursor/`

| 路径或文件 | 职责 |
| --- | --- |
| `.cursor/agents/` | Cursor 子智能体定义。 |
| `.cursor/commands/` | `trellis-*` 命令。 |
| `.cursor/hooks/` | session、shell context 和 sub-agent context hooks。 |
| `.cursor/skills/` | Cursor Skills。 |
| `.cursor/hooks.json` | Cursor hook 注册。 |

### 6.5 `.opencode/`

| 路径或文件 | 职责 |
| --- | --- |
| `.opencode/agents/` | OpenCode 子智能体定义。 |
| `.opencode/commands/trellis/` | OpenCode Trellis 命令。 |
| `.opencode/lib/` | session 与 Trellis 上下文辅助库。 |
| `.opencode/plugins/` | session-start、workflow-state、sub-agent context JavaScript 插件。 |
| `.opencode/skills/` | OpenCode Skills。 |
| `.opencode/package-lock.json` | OpenCode 项目插件依赖锁文件。 |

### 6.6 `.pi/`

| 路径或文件 | 职责 |
| --- | --- |
| `.pi/agents/` | Pi Agent 子智能体定义。 |
| `.pi/extensions/trellis/` | Pi 的 Trellis 扩展。 |
| `.pi/prompts/` | Trellis 操作提示模板。 |
| `.pi/skills/` | Pi Skills。 |
| `.pi/settings.json` | Pi 扩展与项目设置。 |

### 6.7 `.omp/`

| 路径 | 职责 |
| --- | --- |
| `.omp/agents/` | Oh My Pi 子智能体定义。 |
| `.omp/commands/` | Trellis 命令。 |
| `.omp/extensions/trellis/` | Trellis 扩展。 |
| `.omp/skills/` | Oh My Pi Skills。 |

## 7. 仓库治理与辅助目录

### 7.1 `.github/`

| 路径或文件 | 职责 |
| --- | --- |
| `.github/ISSUE_TEMPLATE/` | Bug、功能请求等 Issue 模板。 |
| `.github/workflows/ci.yml` | 安装依赖并执行构建、检查和测试。 |
| `.github/workflows/publish.yml` | npm 包发布流程。 |

### 7.2 `.husky/`

| 路径或文件 | 职责 |
| --- | --- |
| `.husky/pre-commit` | 提交前调用 lint-staged。 |
| `.husky/_/` | Husky 本地生成的 hook 辅助文件，不作为业务源码阅读入口。 |

### 7.3 `assets/`

该目录只存静态资源，不包含程序逻辑：

- `trellis.png`：项目 Logo。
- `trellis-demo.gif`、`trellis-demo-zh.gif`：英文/中文流程演示。
- `workflow.png`、`usecase*.png`：工作流和使用场景插图。
- `meme*.png`：社区传播图片。
- `*-group-qr.*`、`wx_link*.jpg`：社区入口二维码。

### 7.4 `drafts/`

当前用于保存版本发布前的论坛文章草稿。文件可能过时，不应被当作产品行为或正式发布说明的权威来源。

### 7.5 `.learnings/`

本地经验沉淀目录。当前不包含受版本控制的产品源码；若未来加入内容，应明确它与 `.trellis/spec/` 长期工程规范、task research 和 workspace journal 的边界。

## 8. Git 子模块

### 8.1 `docs-site/`

- 独立仓库：`https://github.com/mindfold-ai/docs.git`。
- 使用 Mintlify 和 MDX（Markdown + JSX）构建最终用户文档。
- 不属于根 `pnpm-workspace.yaml`，但在 `.trellis/config.yaml` 中作为 `docs-site` package 接入独立 Spec。
- 该目录有自己的 `package.json`、`docs.json`、英文/中文页面、变更日志和独立许可证。
- 修改它会改变子模块工作树；主仓库最终只记录子模块 commit（提交）指针。

### 8.2 `marketplace/`

- 独立仓库：`https://github.com/mindfold-ai/marketplace.git`。
- 保存可安装的 workflow、Spec 和 Skill 等市场内容。
- 当前没有纳入根 pnpm workspace，也没有主仓库 package 级 Spec。
- CLI 通过 registry/workflow resolver 获取或解析其中的内容。

## 9. 主要执行流程与关键文件

### 9.1 CLI 启动

```text
packages/cli/bin/trellis.js
  → packages/cli/dist/cli/index.js
  → 源文件 packages/cli/src/cli/index.ts
  → 注册 init / update / upgrade / uninstall / mem / workflow / channel
```

### 9.2 `trellis init`

```text
src/cli/index.ts
  → src/commands/init.ts
  → 环境、目录、语言、项目结构和平台选择
  → src/configurators/workflow.ts 创建 .trellis/
  → src/configurators/index.ts 分发各平台 configurator
  → src/utils/file-writer.ts 安全写入并记录所有权
  → src/utils/template-hash.ts 初始化模板 hash
  → .trellis/scripts/init_developer.py 初始化开发者
```

### 9.3 `trellis update`

```text
src/commands/update.ts
  → 收集 .trellis、根文件和已配置平台的期望模板
  → src/utils/template-hash.ts 读取上次写入 hash
  → 分类 new / unchanged / auto-update / locally-changed / user-deleted
  → src/migrations/ 执行版本迁移
  → 备份并按策略写入
  → 更新 .version 与 .template-hashes.json
```

`configure()` 与 `collectTemplates()` 必须生成相同的路径和内容，否则刚初始化的文件会在下一次 update 被误判为本地修改。

### 9.4 会话上下文注入

```text
AI 平台 session/hook 事件
  → 平台目录中的 session-start / workflow-state hook 或 plugin
  → .trellis/scripts/get_context.py
  → 读取 developer、Git、active task、workflow、package 和 Spec
  → 将当前阶段和下一步注入 AI 会话
```

### 9.5 task 生命周期

```text
.trellis/scripts/task.py create
  → 写 task.json + prd.md (+ implement/check JSONL)
  → planning
  → task.py start
  → in_progress
  → 实现、检查、Spec 更新、提交
  → task.py archive
  → .trellis/tasks/archive/<year-month>/<task>/
```

当前任务指针不是全局单文件，而是存放在 `.trellis/.runtime/sessions/<context-key>.json`，因此多个 AI 会话可以处理不同任务。

### 9.6 channel 流程

```text
trellis channel create
  → 创建 channel 元数据和事件目录
trellis channel spawn
  → 选择平台 adapter 并启动 worker
supervisor + inbox watcher
  → 维护 worker 状态、消息投递和中断
packages/core/src/channel/
  → 向下游程序暴露同一领域能力
```

### 9.7 mem 流程

```text
trellis mem ...
  → packages/cli/src/commands/mem.ts
  → packages/core/src/mem/
  → adapters/{claude,codex,opencode,pi,zcode}.ts
  → 统一会话模型、时间/项目过滤、搜索和上下文提取
```

## 10. 生成物与本地状态

| 路径 | 来源 | 是否手工修改 |
| --- | --- | --- |
| `.git/` | Git | 否；仅由 Git 管理。 |
| `.gitnexus/` | `gitnexus analyze` | 否；代码关系索引，可重新生成。 |
| `node_modules/` | `pnpm install` | 否；依赖缓存，可重新安装。 |
| `packages/*/node_modules/` | pnpm workspace | 否。 |
| `packages/*/dist/` | `pnpm build` | 否；从 `src/` 编译生成。 |
| `.trellis/.runtime/` | Trellis hooks 和 task 命令 | 否；会话级本地状态。 |
| `.trellis/.developer` | `init_developer.py` | 通常不提交；通过命令维护。 |
| `.trellis/.template-hashes.json` | init/update | 不直接编辑；由模板同步流程维护。 |
| `.husky/_/` | Husky | 否；安装依赖时生成。 |
| `docs-site/node_modules/` | 文档子模块依赖 | 否。 |

`packages/cli/dist/` 虽然可能存在于工作区，但发布内容应始终从 `packages/cli/src/` 和模板源重新构建。根目录 `.trellis/` 与平台点目录是本仓库运行时副本，也不替代 `packages/cli/src/templates/` 的权威模板。

## 11. 修改位置速查

| 想修改的能力 | 首选位置 |
| --- | --- |
| 新增或修改 CLI 命令 | `packages/cli/src/commands/`，并在 `src/cli/index.ts` 注册。 |
| 修改某个平台生成文件 | `packages/cli/src/templates/<platform>/` + `src/configurators/<platform>.ts`。 |
| 修改所有平台共享的 Skill/命令 | `packages/cli/src/templates/common/`。 |
| 修改 `.trellis/` Python 运行时 | `packages/cli/src/templates/trellis/scripts/`；再同步 dogfood 副本。 |
| 修改 session/workflow context 注入 | `packages/cli/src/templates/shared-hooks/`，OpenCode/Pi 还需核对专用实现。 |
| 修改 task、channel、mem 公共 TypeScript API | `packages/core/src/`。 |
| 修改 CLI 内部 channel 命令和 supervisor | `packages/cli/src/commands/channel/`。 |
| 修改迁移 | `packages/cli/src/migrations/` 和 `src/migrations/manifests/`。 |
| 修改项目长期工程规范 | `.trellis/spec/`。 |
| 修改当前任务需求或计划 | `.trellis/tasks/<task>/`。 |
| 修改最终用户文档 | `docs-site/` 子模块。 |
| 修改本仓库贡献者结构说明 | `docs/`。 |
| 修改 marketplace 内容 | `marketplace/` 子模块。 |

## 12. 维护本文档时的核对清单

仓库结构发生变化时，至少核对：

1. 根 `package.json` 与 `pnpm-workspace.yaml` 的 package 范围；
2. `.gitmodules` 的子模块列表；
3. `packages/cli/src/types/ai-tools.ts` 与 `configurators/index.ts` 的平台注册；
4. `packages/cli/src/templates/` 的新增或删除目录；
5. `packages/core/package.json` 的 exports；
6. `.trellis/config.yaml` 与 `.trellis/spec/` 的 package 映射；
7. `.github/workflows/` 的 CI 和发布入口；
8. `git ls-files` 中新增的顶层目录和关键配置文件；
9. `pnpm build`、`pnpm test`、`pnpm lint` 和文档链接检查结果。

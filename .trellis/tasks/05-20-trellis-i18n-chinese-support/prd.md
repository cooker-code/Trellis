# Trellis i18n（国际化）中文支持

## 目标

为 Trellis 工作流系统增加中文支持。让 `.trellis/` 目录下面向人类/LLM 阅读的文件（workflow.md、agents/*.md、commands、skills、bundled-skills、spec 模板，以及 Python 脚本用户文案）可以通过一个配置开关在中英文之间切换，**不破坏现有架构**，**不阻碍跟上游 GitHub 仓库的同步与合并**。CLI TypeScript 文案暂缓，当前只实施 PR1-B、PR2、PR3。

## 已确认事实

- 仓库结构：
  - 真正的"源"在 `packages/cli/src/templates/`（TypeScript CLI 同步到用户项目的 `.trellis/` 等目录）
  - 用户项目里看到的 `.trellis/workflow.md`、`.trellis/agents/*.md`、`.trellis/scripts/*.py` 都是从模板同步出来的产物
  - `.trellis/.template-hashes.json` 记录了所有模板文件的 SHA256，CLI 用它判断"用户是否手改过"，决定 sync 时是否覆盖
- 模板分布：
  - `packages/cli/src/templates/trellis/` — `.trellis/` 主体（workflow.md、scripts、agents 等）
  - `packages/cli/src/templates/common/` — 通用 commands / skills / bundled-skills
  - `packages/cli/src/templates/{claude,codex,cursor,opencode,gemini,...}/` — 各 IDE/Agent 平台特定文件
  - `packages/cli/src/templates/markdown/spec/` — spec 模板
- 仓库是 fork：`origin` 指向 `cooker-code/Trellis.git`（疑似 fork 自 `mindfoldhq/trellis`），需要保持可以从上游 merge

## 暂定假设

- 用户确认当前中文化范围包含：完整 `.trellis/workflow.md`、agents、common commands/skills、bundled-skills、spec 模板和 Python 脚本用户文案；CLI TypeScript 文案暂缓
- 不需要翻译："技术名词"（命令名、变量名、字段名、JSON key、Python 标识符、git 分支名等）—— 用户已明确说明
- 不需要翻译：代码逻辑、内部 docstring（除非影响 LLM 行为）
- 配置项的位置应该在 `.trellis/config.yaml`（已经是项目级配置文件）

## 待确认问题（需要用户确认的关键决策）

1. ~~**存储方式**~~ ✅ 已决：并列后缀文件
2. ~~**范围**~~ ✅ 已决：L2
3. ~~**运行时机**~~ ✅ 已决：sync 时落地
4. ~~**CLI 汉化边界**~~ ✅ 已决：当前暂不处理 CLI TypeScript 文案；只实施 PR1-B、PR2、PR3
5. ~~**翻译深度**~~ ✅ 已决：翻译全部面向人类/LLM 的自然语言，包括 HTML/Markdown 注释；专有名称和技术标识符保持英文

## 决策（ADR-lite，轻量架构决策记录）

### 决策 1：翻译产物存储方式 = 并列后缀文件

**Context（上下文）**：本仓库是 fork（分叉仓库；origin: cooker-code/Trellis，上游 mindfoldhq/trellis），用户要求“和 GitHub 保持代码更新”。任何修改原英文文件的方案都会跟上游 merge（合并）冲突。

**Decision（决策）**：在模板源 `packages/cli/src/templates/` 内，原英文文件保持不动；中文版以同名 + `.zh.md` / `.zh.py` / `.zh.yaml` 后缀的“并列文件”形式新增。CLI（命令行工具）sync 时按 `language` 配置选择源文件，落地为统一文件名（脱后缀），保证项目里 `.trellis/workflow.md` 始终是当前语言版本。

**Consequences**：
- ✅ 上游 merge 永远不冲突（英文原文未动）
- ✅ 翻译缺失时自然回落到英文（找不到 `*.zh.md` 就用 `*.md`）
- ✅ Git diff 直观（中文只在 `*.zh.*` 文件里）
- ⚠️ 模板文件数量翻倍（每个翻译过的文件多一份）
- ⚠️ 需要工具检测中英版本"漂移"（英文更新后中文未跟上）

### 决策 2：翻译范围 = L2（三个内容 PR）

**Context（上下文）**：模板内可翻译文件分布在多个目录，价值最高的是 LLM（大语言模型）每轮都读到的指令文档。CLI 平台模板（claude/codex/...）是 IDE（集成开发环境）适配层，原文短小且少阅读，性价比低；CLI TypeScript 输出是少量交互提示，引入 i18n runtime（运行时）复杂度高。

**原 Decision（决策）**：覆盖 `templates/trellis/`（workflow + scripts + agents）、`templates/common/{commands,skills,bundled-skills}/` 下所有 Markdown（标记语言）、`templates/markdown/spec/` 下 spec 模板、以及 Python 脚本中面向用户的 print/error 文案。原计划不覆盖各平台目录和 CLI TypeScript。

**范围确认（2026-07-27）**：用户要求先完成前三个内容 PR：PR1-B 完整翻译 `workflow.md`，PR2 覆盖 agents + common commands/skills，PR3 覆盖 bundled-skills + spec 模板 + Python 用户文案。CLI TypeScript command/help/prompt/output 暂缓。技术标识符、命令名、flag、路径、JSON key 保持英文。

**Consequences**：
- ✅ 抓住"用户/LLM 每轮必读"的最大价值文件
- ✅ 不动 CLI TypeScript，避开 i18n runtime 重构
- ✅ common commands/skills 在聚合层按 locale 选择，各平台最终落地内容同步切换
- ⚠️ Python 脚本里的字符串需要轻量 i18n 机制（dict + locale 选择）

### 决策 3：运行时机 = Sync 时落地

**Context（上下文）**：LLM 每轮读取的 `.trellis/workflow.md` 是被多平台（claude/codex/cursor/...）的集成层“硬编码”路径引用的。如果在运行时按 locale（区域语言）切换文件路径，需要在每个平台的读取入口都改。

**Decision（决策）**：在 `trellis init` / `trellis sync` 阶段读取 `config.yaml.language`，决定是把 `workflow.md` 还是 `workflow.zh.md` 复制到目标位置（**统一落地为不带后缀的文件名**，避免污染下游路径）。Python 脚本里 `print/click.echo` 文案则启动时读一次 config 选 dict（字典）。切换语言 = 改 config + 重跑 sync。

**Consequences**：
- ✅ 所有平台的"读 .trellis/workflow.md"路径不变
- ✅ 落地后是"扁平英文路径，内容是中文"，对 LLM 透明
- ⚠️ 用户必须 `trellis sync` 才能切换语言生效（需在文档强调）
- ⚠️ 中英两份模板必须保持文件路径的一一对应

### 决策 4：翻译全部自然语言，保留专有名称

**Decision（决策）**：`*.zh.md` 中所有面向人类或 LLM 的自然语言正文、表格、提示和 HTML（超文本标记语言）/Markdown 注释均翻译为中文。产品名、平台名、Trellis 领域术语及技术标识符保持英文，避免同一概念出现多个中文别名，也避免破坏 runtime parser（运行时解析器）。

**必须原样保留**：命令/flag、路径、环境变量、JSON key、状态值、代码标识符、占位符、Phase/Step 编号、`[workflow-state:*]` 标签、平台 marker，以及 Claude Code / Cursor / Codex / Pi 等平台名。

## 需求

### R1 配置与回落
- [ ] `.trellis/config.yaml` 引入 `language` 字段，默认 `en`，合法值 `en` / `zh`
- [ ] CLI 提供 `trellis init --language <code>` / `trellis sync --language <code>` flag，用于一次性覆盖 config（不写盘）
- [ ] 翻译缺失某文件时静默回落到英文（用 logger.debug 记录，不报错）

### R2 模板组织
- [ ] 模板源遵循"并列后缀"约定：英文 `foo.md`、中文 `foo.zh.md`；同一目录平铺
- [ ] sync 时根据当前语言决定：`zh` → 优先取 `*.zh.md`（缺则取 `*.md`），落地为 `*.md`（脱后缀）
- [ ] `.template-hashes.json` 对 i18n 透明：key 仍是脱后缀落地路径（如 `.trellis/workflow.md`），value 是落地内容的 SHA256（中文模式下=中文 hash，英文模式下=英文 hash）。i18n 仅在 `collectTemplateFiles` 上游做"源选择"，hash 系统零改动。详见 `research/template-hashes.md`。

### R3 内容覆盖（L2）
- [ ] **PR1-B**：把当前占位 `workflow.zh.md` 替换为完整中文翻译（包括自然语言注释），并验证所有 runtime 标记结构与英文版等价
- [ ] **PR2**：翻译 trellis agents、common commands 和 common single-file skills，并让所有平台落地内容按 locale 选择
- [ ] **PR3**：翻译 bundled-skills 全部 Markdown/reference、spec 模板，并完成 Python 用户文案迁移
- [ ] 提供翻译路线图（在 PRD / docs-site 列出待译文件清单）

### R4 Python 脚本 i18n
- [ ] 新增轻量 `scripts/common/i18n.py`：`t(key, **kwargs)` + `set_locale(code)`，背后是 dict
- [ ] 入口脚本（`task.py` / `init_developer.py` / `add_session.py`）启动时读 config 调用 `set_locale`
- [ ] 现有 print/error 文案逐步迁移到 `t(key)`（PR1 仅做框架 + `init_developer.py` 迁移示例）

### R5 漂移检测
- [ ] 新增 `packages/cli/scripts/check-i18n-drift.js`：扫描 `templates/`，对每个 `*.zh.md` 检查
  - 是否有对应英文文件存在
  - 英文文件 git hash 是否新于该 `*.zh.md`（提示需要更新翻译）
- [ ] 接入 `pnpm test` / CI（仅 warning 不 fail），让翻译漂移可见

### R6 文档与不破坏现状
- [ ] `README.md` 增补 i18n 使用一节；`README_CN.md` 同步中文版
- [ ] `docs-site` 增补 i18n 使用页（仅英文 + 列出 zh 路线图）
- [ ] 默认 `language=en`（或不配置）时，与现状完全等同

## 验收标准

- [ ] 在 `.trellis/config.yaml` 设 `language: zh` 后跑 `trellis update`，`.trellis/workflow.md` 是完整中文内容（不存在占位英文正文）
- [ ] Claude/Cursor/Pi/Codex 等平台最终生成的 common commands/skills 为中文，文件名和调用方式不变
- [ ] 切回 `language: en` 后跑 `trellis sync`，`.trellis/workflow.md` 与上游 mindfoldhq/trellis main 完全一致
- [ ] `git merge upstream/main` 不产生冲突（前提：上游未改动 `*.zh.*` 文件——按定义不会）
- [ ] 删除某个 `*.zh.md` 后跑 `trellis sync language=zh`，对应文件回落英文版（不报错）
- [ ] `trellis init --language zh` 临时覆盖 config 生效
- [ ] `pnpm run i18n:check` 检测到中英漂移时给出 warning（含具体文件路径）
- [ ] Python 脚本：`task.py create "x"` 等命令在 zh 模式下输出中文提示
- [ ] 单元测试：(a) sync 时按 locale 选源文件 (b) 缺失回落 (c) `.template-hashes.json` 不被中文模板污染 (d) i18n.py 的 `t()` 切换效果

## 实施计划（小 PR 拆分）

**PR1-A — i18n 机制骨架（已合入 main，内容不完整）**
- 已完成 locale 解析、`workflow.<locale>.md` 选择、hash 透明、drift 脚本和 Python i18n 骨架
- 当前 `workflow.zh.md` 仅前约 38 行中文，其余为英文占位，不能视为中文支持完成

**PR1-B — 完整 workflow.md 中文翻译 + 结构等价验证**
- 完整翻译 `packages/cli/src/templates/trellis/workflow.zh.md` 的人类/LLM 可读正文和注释
- 保持命令、路径、状态名、占位符、Phase/Step 编号、workflow-state 标签和平台 marker 不变
- 新增中英文结构等价测试 + 中文落地 integration test
- 更新 drift 检测和 README 使用说明

**PR2 — 扩展到 trellis/agents 与 common/commands+skills**
- 新增 `templates/trellis/agents/{implement,check,research}.zh.md`
- 新增 `templates/common/commands/{start,continue,finish-work}.zh.md`
- 新增 `templates/common/skills/*.zh.md`
- 扩展 i18n.py 字典覆盖 `task.py` / `add_session.py`

**PR3 — bundled-skills + spec 模板 + Python 脚本全量 i18n**
- 新增 `templates/common/bundled-skills/**/*.zh.md`（trellis-meta、trellis-spec-bootstarp）
- 新增 `templates/markdown/spec/*.zh.md`
- Python 脚本剩余文案迁移
- docs-site i18n 路线图页面

**未来 PR (out of MVP)**
- L3：各平台专属模板（claude/codex/cursor/...）中不由 common templates 生成的内容
- 新增更多语言（ja / es / fr）

## 不在范围内（暂不做）

- 翻译 spec 内的用户业务文档（这些是用户自己写的，不是模板）
- 翻译 `docs-site` 全站
- CLI TypeScript 的 command/option/help、交互 prompt、warning/error、summary、内部异常栈和调试日志（本轮全部暂缓）
- 翻译各平台目录（claude/codex/cursor/...）的提示模板
- 多于中英两种语言（先 i18n 框架到位，新增语言留作后续）
- 自动机器翻译——翻译文本由人工/LLM 离线产生并 review，不在运行时调用翻译 API

## 完成定义

- 单元测试新增并通过
- `pnpm lint && pnpm typecheck && pnpm test` 全绿
- 文档更新：在 `README.md` / `docs-site` 增补 i18n 使用说明的英文条目；中文等同条目在 `README_CN.md`
- 不破坏 `trellis init` / sync / migration 现有行为（`language` 默认未启用时与现状完全一致）

## 技术说明

- 关键文件：
  - `.trellis/.template-hashes.json` — 模板同步状态，必须设计成对 i18n 透明
  - `packages/cli/src/templates/` — 模板源
  - `packages/cli/src/configurators/` — 配置分发
  - `packages/cli/src/migrations/` — 升级脚本
- 上游同步约束：英文原文路径不能变；新增内容应"加在旁边"而不是"替换"
- 已经存在 `README_CN.md`，说明项目对中英双版有先例

## 研究参考

* [`research/sync-call-chain.md`](research/sync-call-chain.md) — init/update 是事实上的 sync 入口；`workflowMdTemplate` 是顶层 const 必须改函数化；介入点 = 源端聚合层（A）+ CLI 入口注入（D）。
* [`research/template-hashes.md`](research/template-hashes.md) — hash 跟踪以"落地路径+落地内容"为契约；i18n 在源选择层透明，hash 系统零改动；切语言后必须 `updateHashes` 否则误判用户手改。
* [`research/config-and-python-i18n.md`](research/config-and-python-i18n.md) — TS 端无统一 schema，仿 `loadUpdateSkipPaths` 写 5-10 行 reader；Python 端共享 `_load_config`；i18n 字典拆 `i18n_strings/{en,zh}.py` 子模块；优先级 `flag > env(TRELLIS_LANGUAGE) > config.yaml > "en"`。

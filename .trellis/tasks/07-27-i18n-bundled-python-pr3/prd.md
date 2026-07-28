# i18n PR3：中文内置技能、规范模板、Python 文案与 Task 内容

## 目标

完成 Trellis i18n（国际化）的第三阶段交付：

1. 为 bundled skill（内置技能）及其递归引用补齐中文内容。
2. 为 spec template（规范模板）补齐中文内容。
3. 将核心 Python（编程语言）脚本中面向用户的文案接入现有字典式 i18n。
4. 在现有 Release（发布版）文档中完整说明中英文覆盖范围和回落规则。
5. 让中文模式下新建和维护的 Trellis task（任务）默认使用中文自然语言。

用户选择 `zh` 后，应在不改变落地路径的前提下获得中文内容；英文保持默认语言，缺少中文翻译时安全回落到英文。

## 背景与已确认事实

- PR1-A 已提供 locale（区域语言）解析、`language: en|zh`、`--language`、`TRELLIS_LANGUAGE`、工作流源选择及 Python `common/i18n.py`。
- PR2 已提供 Agent（代理）、Command（命令）和单文件 Skill（技能）的语言选择与传播；PR3 复用该契约，不创建第二套语言解析器。
- bundled skill 从 `templates/common/bundled-skills/**` 递归加载；直接加入 `*.zh.md` 会让双语源文件同时泄漏到用户项目。
- 当前 bundled skill 有 38 个英文 Markdown（标记语言）文件，其中 11 个没有中文对应文件。
- 当前有 17 个 spec `*.md.txt` 源文件，中文对应文件已经齐全；其中 16 个会实际落地，`guides/cross-platform-thinking-guide.md.txt` 保持未注册。
- `.trellis/spec/` 创建后属于用户内容，`trellis update` 不得因切换语言而覆盖。
- 当前仓库共有 232 个 task，其中 227 个已归档、5 个仍活动。
- `task.py create` 的默认 `prd.md` 骨架固定为英文，中文模式尚不能生成中文任务骨架。
- 当前用户负责的活动 task 只有父任务 `05-20-trellis-i18n-chinese-support` 和本 PR3。
- TypeScript（类型脚本）CLI（命令行工具）的通用 command/help/prompt/output 中文化不属于本 PR。

## 范围决策

采用用户确认的范围 1：

- 中文化 PR3 的全部 task 产物：`task.json` 中面向人的字段、`prd.md`、`design.md`、`implement.md`、`research/*.md`、JSONL（逐行 JSON）清单中的自然语言说明。
- 中文化当前用户负责且尚未归档的父任务内容。
- 让未来在 `language: zh` 下创建或由中文 Agent 维护的 task 默认使用中文。
- 不改写 227 个历史归档 task。
- 不改写其他开发者负责的活动 task。

## 统一语言规范

- 标题、目标、背景、需求、设计说明、执行计划、验收标准、风险、研究结论和说明文字使用中文。
- 英文技术术语在每个文档首次出现时使用 `English（中文解释）`；后续可以只保留英文。
- 产品名和技术名称保留英文，例如 Trellis、GitNexus、CLI、API、JSON、JSONL、Markdown、Python、TypeScript、MDX。
- 命令、参数、路径、文件名、配置键、状态值、代码标识、占位符、协议标签、JSON 字段、代码块和链接目标保持原样。
- 不翻译会被机器解析或作为稳定协议使用的文本。
- 中文 Skill、Command、Agent 和工作流必须明确要求 AI（人工智能）在新建或维护 task 时遵守本规范。

## 依赖

1. PR2 的语言传播和本地化选择 API（应用程序接口）必须存在。
2. init（初始化）和 update（更新）必须共享同一活动语言。
3. 若现有 API 与规划不一致，应先更新设计，不得复制一套新的语言选择逻辑。

## 需求

### R1：翻译源组织

- 英文源保持规范源地位，不为翻译而修改英文正文。
- 中文源与英文源并列：
  - bundled Markdown：`foo.md` + `foo.zh.md`；
  - spec 源：`foo.md.txt` + `foo.zh.md.txt`；
  - Python 文案：`i18n_strings/en.py` + `i18n_strings/zh.py`。
- 英文源定义逻辑文件和字典键集合。
- 覆盖范围内面向用户或 LLM（大语言模型）的自然语言及 Markdown/HTML 注释必须翻译。

### R2：bundled skill 递归加载

- 每个英文 bundled skill Markdown 及其递归引用必须有中文对应文件。
- `zh` 模式优先选择中文文件，单文件缺失时回落英文。
- 输出始终使用不带语言后缀的逻辑路径。
- 不得把 `*.zh.md` 写入任何平台目录或 `.template-hashes.json`。
- 非本地化资源保持不变。
- cache（缓存）必须按 locale 隔离，`en -> zh -> en` 连续解析不能串语言。
- init writer（初始化写入器）和 update collector（更新收集器）必须产生相同的目标路径和内容映射。

### R3：spec template

- 每个英文 `*.md.txt` 源必须有 `*.zh.md.txt` 对应文件。
- `language=zh` 的 init/re-init（重新初始化）选择中文内容，缺失时回落英文。
- backend/frontend/fullstack、monorepo 和 remote template 的路由保持不变。
- 未注册的 cross-platform guide 保持未注册。
- update 切换语言时不得覆盖既有 `.trellis/spec/`。

### R4：核心 Python CLI 文案

- 复用 `common.i18n.set_locale()` 和 `t(key, **kwargs)`，不引入 gettext/Babel 或其他解析器。
- 各核心入口必须在创建 argparse（参数解析器）和输出前解析一次语言。
- 覆盖以下入口及其共享模块中的用户可见成功、警告、错误、提示、帮助和文本上下文：
  - `task.py`；
  - `add_session.py`；
  - `get_context.py` / `common/git_context.py`；
  - `get_developer.py`；
  - `init_developer.py`。
- 英文和中文字典的键集合、格式占位符集合必须一致。
- 保持退出码和 stdout/stderr（标准输出/标准错误）通道不变。
- 保持机器消费内容不变：原始路径、`task.py current --source` 标签、JSON schema（结构定义）、enum（枚举）值和技术 token（标记）。
- workspace journal/index 的持久化 schema、可选 `linear_sync.py`、平台 Python hook、自测/调试输出及无效 locale 的启动警告继续作为明确排除项。

### R5：漂移与结构检查

- i18n 检查必须识别 `*.zh.md.txt` 复合后缀。
- 缺少英文源或中英文时间漂移时给出警告；默认只警告，`--strict` 返回非零。
- 检查 Python 中英字典键和每个键的格式占位符。
- 动态检查中英文源配对，不硬编码文件数量。
- 检查目标路径一致性、frontmatter（头部元数据）身份字段、占位符、链接目标、代码围栏和受保护 token。
- 新增 task 内容语言检查：中文模式的 task 骨架和代表性 Agent 输出不得包含未解释的大段英文自然语言。

### R6：文档站排除项

- 用户于 2026-07-28 确认本 PR3 不生成或提交 docs-site（文档站）内容。
- 已丢弃 docs-site 中的本地生成物，并确认 submodule（子模块）恢复干净。
- 文档站说明与导航不再作为本 PR3 的完成条件。

### R7：Trellis task 内容中文化

- `_default_prd_content` 必须根据活动语言生成英文或中文 PRD 骨架。
- `.trellis/scripts/` 与 `packages/cli/src/templates/trellis/scripts/` 的生成逻辑保持同步。
- 中文 PRD 骨架使用中文标题和说明，但 `prd.md`、`design.md`、`implement.md`、`task.py start` 等技术文件名和命令保持原样。
- 中文 Skill、Command、Agent 和工作流中与 task 规划、实施、检查、归档有关的指令必须使用中文自然语言。
- PR3 与父任务的所有自然语言 task 产物按统一语言规范完成中文化。
- 历史归档 task 和其他开发者 task 不在本次改写范围内。

### R8：低侵入与 upstream 同步

- 开始产品代码实现前，`main` 必须先快进到最新 `upstream/main`，再把该基线合入 `data-developer`。
- PR3 优先新增 `*.zh.*` 和测试，不为翻译修改英文规范源正文。
- 既有上游运行时代码只允许修改中文 task 默认骨架所需的最小调用链及其根脚本/template 双份同步。
- bundled skill、spec template 和 Python i18n 的既有实现若已满足验收，只做回归验证，不重复重构。
- 每次同步前使用 `git merge-tree --write-tree` 预检；出现冲突时停止并让用户确认解决策略。
- 每个 PR3 提交应按“纯新增翻译”“最小运行时接入”“task 文档”拆分，便于上游合并时独立审查或回滚。

## 验收标准

- [x] 38 个英文 bundled skill Markdown 均有中文对应文件，动态配对检查无缺失。
- [x] `zh` init/update 在正常无后缀路径落地中文 bundled skill，目标路径不包含 `.zh.`。
- [x] 缺少单个中文翻译时自动回落英文，命令不失败。
- [x] 同一进程中 `en -> zh -> en` 返回正确内容，无 cache 污染。
- [x] 所有平台 collector 的中英文逻辑目标路径集合一致。
- [x] 17 个 spec `*.md.txt` 均有中文对应文件；`zh` init 在无后缀 `.trellis/spec/**` 路径落地代表性中文规范。
- [x] 英文 init 输出与英文规范源保持字节兼容。
- [x] 未注册的 cross-platform guide 仍未注册，remote template 行为不变。
- [x] update 切换语言不覆盖既有 `.trellis/spec/`。
- [x] `task.py`、`add_session.py`、`get_developer.py`、`get_context.py` 的代表性文案在 `zh` 下为中文，默认仍为英文。
- [x] Python 的 `zh -> en -> key` 回落、字典键一致性和占位符一致性有测试。
- [x] `task.py current --source`、原始路径、JSON schema、退出码和输出通道在两种语言下保持稳定。
- [x] `language: zh` 下 `task.py create` 生成中文 PRD 骨架；`language: en` 或未配置时保持现有英文输出。
- [x] 中文 PRD 中技术术语首次出现符合 `English（中文解释）`，命令、路径和标识符保持原样。
- [x] PR3 和父任务范围内的 Markdown/JSONL/task.json 自然语言内容完成中文化。
- [x] 中文 Agent/Skill/Command 对 task 产物的语言要求可通过代表性模板测试验证。
- [x] `main == upstream/main` 后再开始 PR3 产品代码实现，且该基线已经合入 `data-developer`。
- [x] PR3 没有修改英文规范源正文；新增运行时改动限定在 task 中文骨架的最小调用链。
- [x] `data-developer` 与实现时最新 `upstream/main` 的 merge-tree 预检无未解决冲突。
- [x] i18n 检查覆盖 Markdown、spec 复合源、Python 字典和 task 内容语言规则。
- [x] CLI lint、typecheck、Python lint、测试、i18n 检查和 build 全部通过。
- [x] docs-site 本地生成物已丢弃，子模块状态干净。

## 不在范围内

- TypeScript CLI 的通用 command/help/prompt/warning/error/summary 中文化。
- 新增语言选择参数、配置读取器或优先级规则。
- PR2 common source 之外的平台专属模板。
- 运行时机器翻译或翻译 API。
- 中英文之外的语言。
- 切换语言时重写用户已有 `.trellis/spec/`。
- workspace journal/index 的持久化 schema 中文化。
- 可选 `linear_sync.py` 和平台 hook Python 输出。
- 重命名产品名、文件名、命令、状态或技术标识。
- 改写 227 个历史归档 task。
- 改写其他开发者负责的活动 task。

## 风险

- 递归加载器可能把双语源同时落地；使用英文规范集合加中文 overlay（覆盖层）并测试无后缀目标。
- cache 未按语言隔离会产生跨语言污染；增加顺序切换测试。
- Python 文案迁移可能破坏脚本消费者；使用协议保留清单和 subprocess（子进程）测试。
- task 内容检查若过度依赖中文字符比例，会误判代码和技术文档；只检查自然语言区域和代表性生成结果。
- 批量翻译 task 产物可能误改历史或他人工作；文件清单必须限制在两个已确认的活动任务。

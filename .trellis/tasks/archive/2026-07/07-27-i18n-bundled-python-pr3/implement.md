# 实施计划：i18n PR3

## 当前基线

- PR1-B 和 PR2 已完成并归档。
- PR3 的 spec template（规范模板）、核心 Python（编程语言）文案、i18n checker（国际化检查器）及主要 bundled skill（内置技能）中文化已在 `bf5a6718` 中落地。
- 当前 CLI（命令行工具）全量测试为 81 个文件、1794 项通过。
- 当前仍缺少 11 个新增 bundled skill 中文文件。
- 用户已确认本 PR3 不生成或提交 docs-site（文档站）内容。
- `task.py create` 仍固定生成英文 PRD（产品需求文档）骨架。
- PR3 与父任务仍有英文 task（任务）产物。

## 0. 开发前门禁

- [x] 用户审查并明确批准最新 `prd.md`、`design.md` 和本实施计划。
- [x] 获取最新 `upstream/main`，确认本地 `main` 的领先/落后关系。
- [x] 使用 merge-tree（合并树）预检 `data-developer` 与最新 `upstream/main`；冲突时暂停确认。
- [x] 将 `main` 快进到最新 `upstream/main`，再把 `main` 合入 `data-developer`。
- [x] 读取 `implement.jsonl`、`check.jsonl` 及引用的 Spec（规范）和 research（调研）文档。
- [x] 运行 `python3 ./.trellis/scripts/get_context.py --mode packages`，读取 CLI 与测试相关规范。
- [x] 记录根仓库和 marketplace 的 Git 状态，保留无关修改。
- [x] 重新统计 bundled Markdown、spec `*.md.txt`、Python 字典和 task 产物。
- [x] 修改任何 function/class/method（函数/类/方法）前运行 GitNexus impact（影响分析）；HIGH/CRITICAL 风险必须先告知用户。

回滚点：未完成最终规划批准前，不修改产品代码。

## 1. 中文化本次允许范围内的 task 产物

- [x] 将 PR3 的 `task.json` 面向人字段、`prd.md`、`design.md`、`implement.md`、`research/*.md` 及 JSONL 原因说明全部改为中文自然语言。
- [x] 将父任务 `05-20-trellis-i18n-chinese-support` 的面向人 task 内容收敛为中文。
- [x] 首次技术术语使用 `English（中文解释）`，后续可只写英文。
- [x] 保持命令、路径、文件名、配置键、状态值、代码标识、placeholder（占位符）、JSON 字段和链接目标不变。
- [x] 使用明确允许列表证明没有修改 `archive/**` 或其他开发者 task。
- [x] 检查 Markdown 链接和 JSON/JSONL 语法。

审查门禁：Git diff（差异）中的 task 文件只能来自上述两个活动目录。

## 2. 增加失败测试

- [x] 动态发现所有 bundled skill 英文 Markdown，并要求存在中文对应文件。
- [x] 为当前 11 个缺失中文文件建立可失败的配对证据。
- [x] 为 `_default_prd_content` 增加英文默认与中文骨架精确测试。
- [x] 增加中文技术术语格式、命令/路径保留的代表性测试。
- [x] 增加中文 Agent（代理）/Skill（技能）/Command（命令）包含 task 语言规范的测试。
- [x] 保留缺失翻译回落、`en -> zh -> en` cache（缓存）隔离及无 `.zh.` 目标路径测试。

审查门禁：删除任一中文 bundled 文件、移除 task 语言规则或让中文模式生成英文骨架时，测试必须失败。

## 3. 补齐新增 bundled skill 中文文件

- [x] 翻译 `trellis-channel/**` 的 6 个缺失文件。
- [x] 翻译 `trellis-session-insight/**` 的 3 个缺失文件。
- [x] 翻译 `trellis-meta/references/local-architecture/` 下 2 个新增文件。
- [x] 对已有 bundled 中文文件进行结构和自然语言复核，修正明显机器直译、残留大段英文和术语格式问题。
- [x] 保持 frontmatter（头部元数据）、命令、路径、参数、代码、placeholder、链接和协议字段不变。
- [x] 运行动态结构配对与 i18n 漂移检查。

审查门禁：所有英文 bundled Markdown 均有中文对应文件，且英文规范源没有仅为翻译产生的正文修改。

## 4. 中文 task 默认骨架

- [x] 对 `.trellis/scripts/common/task_store.py::_default_prd_content` 运行 GitNexus impact。
- [x] 设计显式语言参数或复用已解析 locale，不增加第二套配置解析。
- [x] `language: zh` 生成中文章节：目标、需求、验收标准、说明。
- [x] `language: en` 或未配置时保持当前英文字节行为。
- [x] 同步修改 CLI template 副本，根脚本与模板脚本保持一致。
- [x] 保持 `task.py create` 的原始路径 stdout、退出码、task.json schema（结构定义）和 lifecycle hook（生命周期钩子）行为。
- [x] 添加 subprocess（子进程）集成测试，覆盖 env/config/default 优先级和两种语言。

回滚点：该步骤可以按 `_default_prd_content`、调用链和测试整体回滚，不影响既有 task。

## 5. 向中文工作流与 Agent 指令注入 task 语言规范

- [x] 盘点所有会创建或维护 task 产物的中文 workflow、Skill、Command 和 Agent。
- [x] 在共同入口写入一次权威语言规范，避免每个平台复制不同版本。
- [x] 仅在确有平台独立入口时添加平台侧说明。
- [x] 明确“自然语言中文、首次术语中英注释、机器文本保持原样、历史归档和他人任务不改写”。
- [x] 验证所有平台生成路径仍保持原文件名和调用协议。

审查门禁：代表性中文初始化项目中的规划、实施、检查指令都能读取同一语言规则。

## 6. 复核既有 PR3 功能

- [x] 重新验证 17 个 spec `*.md.txt` 均有中文对应文件。
- [x] 验证 16 个已注册 spec 在 `zh` init 时按无后缀路径落地，cross-platform guide 保持未注册。
- [x] 验证 update 不重写已有 `.trellis/spec/`。
- [x] 重新验证 Python 字典键和 placeholder 一致性。
- [x] 验证 `task.py current --source`、原始路径、JSON schema、退出码和 stdout/stderr（标准输出/标准错误）通道稳定。
- [x] 验证 `i18n:check` 识别 `*.zh.md.txt` 和 Python 漂移。

## 7. 排除 docs-site

- [x] 按用户 2026-07-28 的最终决定，不生成或提交 docs-site 内容。
- [x] 丢弃本轮 docs-site 本地生成物。
- [x] 确认 docs-site submodule（文档站子模块）状态干净且根仓库指针未变化。

## 8. 全量验证

根仓库：

```bash
pnpm --filter @mindfoldhq/trellis-core build
pnpm --filter @mindfoldhq/trellis build
pnpm --filter @mindfoldhq/trellis lint
pnpm --filter @mindfoldhq/trellis typecheck
pnpm --filter @mindfoldhq/trellis lint:py
pnpm --filter @mindfoldhq/trellis test
pnpm --filter @mindfoldhq/trellis i18n:check
```

- [x] 使用构建后的 CLI 分别执行 `en`、`zh` init smoke test（冒烟测试）。
- [x] 验证目标路径和 hash 键没有意外 `.zh.`。
- [x] 验证英文默认输出字节兼容。
- [x] 验证中文 task 骨架、代表性中文 Agent 语言规则和技术术语格式。
- [x] 验证两个允许目录之外的 task 没有被修改。
- [x] 运行 GitNexus detect-changes（变更检测），确认受影响符号、流程和文件符合计划。
- [x] 对比实现基线 `upstream/main`，确认英文规范源正文没有修改，新增运行时代码只落在 task 中文骨架的最小调用链。
- [x] 再次运行 merge-tree 预检，确认未来同步没有新增未解决冲突。
- [x] 回读根仓库 Git 状态，并确认 docs-site 子模块干净。

## 9. 规范沉淀、提交与归档

- [x] 判断 task 内容语言规范是否应写入 `.trellis/spec/`，需要时使用 `trellis-update-spec`。
- [x] 按 Conventional Commits（约定式提交）拆分 task 文档、CLI 功能和 bundled 翻译提交。
- [ ] 提交前再次执行 GitNexus detect-changes。
- [ ] 确认所有验收标准和实施清单均有真实证据后，运行 `trellis-finish-work`。
- [ ] 先归档 PR3，再检查父任务是否达到 `3/3 done`；父任务满足总体验收后再归档。
- [ ] 记录 session journal（会话日志），归档提交不作为工作提交引用。

## 关键回滚点

- 测试层可独立回滚，不改变运行时。
- bundled 中文文件删除后自动回落英文。
- task 骨架改动按函数、调用链和测试整体回滚。
- task 文档只允许修改两个活动目录，可通过路径清单整体撤销。
- docs-site 不产生本 PR3 提交。
- 不执行任何历史归档 task 的批量迁移。

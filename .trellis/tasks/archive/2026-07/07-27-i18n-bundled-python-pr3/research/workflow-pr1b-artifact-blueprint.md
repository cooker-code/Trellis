# 调研：完整 PR1-B 规划产物蓝图

- **查询**：为 `.trellis/tasks/07-27-i18n-workflow-pr1b` 起草完整的 `prd.md`、`design.md`、`implement.md`、`implement.jsonl` 和 `check.jsonl`，但不编辑该任务。
- **范围**：内部规划。
- **日期**：2026-07-27

## 关键任务解析限制

`python3 ./.trellis/scripts/task.py current --source` 当时解析为：

```text
Current task: .trellis/tasks/07-27-i18n-bundled-python-pr3
Source: session:claude_f7ca65de-dbf9-4d8c-83f7-5b0c1c6efca4
```

委派目标为 `.trellis/tasks/07-27-i18n-workflow-pr1b`，但 Research Agent（调研代理）契约只允许写入**已解析当前任务**的 `research/` 目录。因此目标任务文件没有修改。调用方应有意识地解析/切换会话指针，再将本蓝图复制或调整到 PR1-B 任务；该规划交接期间不得运行 `task.py start`。

## 建议 `prd.md`

标题应为 `# i18n PR1-B：完整中文 workflow`。目标：将 PR1-A 示例 `workflow.zh.md` 替换为当前内置原生 workflow 的完整中文翻译，保持每一项机器消费契约，并证明中文 init/update/运行时路径与英文等价。

需求应覆盖：

- 翻译 `packages/cli/src/templates/trellis/workflow.zh.md` 中所有面向人和 LLM 的标题、正文、表格、prompt 示例、代码块注释及 HTML/Markdown 注释；以当前 `workflow.md` 为唯一语义来源，删除 PR1-A placeholder 和过时英文正文；
- 原样保留命令、参数、slash command、路径、文件名、环境变量、JSON/YAML 键、代码标识、状态值、精确运行时字面量、Phase/Step 数字、`[required · once]` 等限定符、workflow-state 开闭标签、平台 marker、placeholder、代码围栏语言和链接目标；英文源字节不变；
- 让中文 Phase Index 标题及 Step 标题可被 `get_context.py`、bundled Python 解析器、Python/Codex/Copilot SessionStart、OpenCode SessionStart 和逐轮 breadcrumb 解析器消费；边界算法不得硬编码中文标题，应由保留 workflow-state 结构推导，并兼容既有英文/自定义 workflow；
- 在保留既有对应文件/Git 时间检查的基础上，加入 workflow 结构一致性：标签、marker、Step/限定符、标题大纲、代码围栏、行内技术片段、placeholder/XML 标签、链接目标、受保护 token 和注释块数量；默认警告、`--strict` 失败；
- 覆盖 `getWorkflowTemplate("zh")`、中文 init 无后缀落地/hash、从 pristine 英文切换的 update/hash 刷新/幂等、中文 Phase Index/Step/平台过滤/SessionStart/breadcrumb，以及既有英文用例。

约束：不改变 workflow 语义、门禁、路由或示例；不改 `workflow.md`；不绕过 `.template-hashes.json` 冲突保护；分发 Python 保持标准库和 Python 3.9；规划未经审查不得启动任务。范围外：PR2 agent/common command/common skill、PR3 bundled/spec/Python 文案、TypeScript CLI 输出、平台专属指令模板、marketplace workflow、新 locale、README/docs-site。

验收应精确要求：所有主要章节和 Step 中文化；自动结构比较输出类别诊断；所有受保护内容等价；中英文运行时提取与 SessionStart/breadcrumb 正确；`init({ language: "zh" })` 写入 `.trellis/workflow.md` 且无 `.zh.md` 键；同版本 update 正确切换与幂等；默认英文兼容；`pnpm run i18n:check`、lint、typecheck、聚焦测试及全量测试通过。

## 建议 `design.md`

设计应明确英文 `workflow.md` 是唯一规范源，中文同级源从当前英文重建，仅翻译自然语言。核心决策如下：

1. **语言无关 Phase Index 边界**：先使用旧英文精确锚点；否则找 `[workflow-state:no_task]`，回退至其所属最近 `## ` 标题，并以前方下一个 `## ` 标题作为排他结束；均不存在则保留空结果/调用方回落。`get_step`、状态 regex、平台匹配不改。
2. **为何不双语硬编码**：硬编码中文标题会延续语言耦合并使未来每种语言都需改解析器；已有 workflow-state 标签已是稳定且唯一的机器锚点。
3. **结构比较模型**：在 `check-i18n-drift.js` 中添加可导入的 `extractWorkflowStructure(content)`、`compareWorkflowStructure(enContent, zhContent)` 与受 guard 保护的 `main()`；深度语法仅用于 workflow 对，通用翻译保持原检查。比较结果按类别诊断，普通模式累计 `structural` 警告，`--strict` 纳入失败条件。
4. **init/update 数据流**：`--language zh` 到 `getWorkflowTemplate("zh")` 再经 Python placeholder 渲染，写入 `.trellis/workflow.md` 并基于落地字节建 hash；update 根据 config/env 选择中文，用同一无后缀键让 pristine 英文自动更新和刷新 hash。
5. **失败/兼容**：英文默认不变；带英文标题的用户 workflow 继续解析；没有任一锚点的自定义 workflow 保持既有失败行为；hash 冲突仍走标准整文件更新。

预期产品/测试边界：`workflow.zh.md`，`workflow_phase.py`，shared/Codex/Copilot `session-start.py`，OpenCode `session-utils.js`，`check-i18n-drift.js`，及对应 checker、i18n、init、update、regression、OpenCode 测试。风险缓解：从规范英文重建并加后部哨兵；精确保护 token 比较；所有解析器族均加 no-task 边界；深度语法只限 workflow；config 驱动 fixture 避免环境泄漏。

## 建议 `implement.md`

执行顺序：

1. **预检**：确认 `task.py current --source` 指向 PR1-B；记录 `git status --short`；读取任务、JSONL、研究和规范；每次改 function/class/method 前运行 GitNexus upstream impact（上游影响分析），HIGH/CRITICAL 先告知用户；确认英文源不在编辑集。
2. **可执行结构契约**：将 checker 重构为纯 helper + CLI；实现结构提取/类别诊断/严格模式；为每类别写正反例；先证明过时 PR1-A 中文源会有意义地失败。
3. **重建翻译**：从当前英文源替换 `workflow.zh.md`，翻译全部自然语言，保留受保护内容，删除 placeholder；运行一致性/完整性测试并逐章节人工审阅。
4. **解析器兼容**：在 `workflow_phase.py`、shared/Codex/Copilot Python SessionStart 和 OpenCode 中落实英文优先 + no-task 回落；不改 `get_step`、状态 regex、平台匹配、Codex 路由或回落字典；增加中文与畸形锚点用例。
5. **init 集成**：中文模板完整性、精确落地内容、无语言后缀路径/hash、生成 `get_context.py` 的 Phase Index/Step/平台过滤；英文精确断言保留。
6. **update 集成**：从带有效英文 hash 的项目开始，设置用户拥有的 `language: zh`，运行非交互自动更新，验证中文内容/hash/config 和二次运行幂等；恢复任何 `TRELLIS_LANGUAGE`。
7. **验证与复核**：运行聚焦 Vitest、`pnpm run i18n:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`；确认英文源无 diff、变更仅限 PR1-B；提交前运行 `npx gitnexus detect-changes --scope all`。规划阶段不启动/归档/提交。

回滚点：结构签名过严时独立回滚 checker/测试；翻译评审失败时只还原 `workflow.zh.md`；解析器兼容改动必须作为跨 Python/JS 副本整体回滚；测试若揭露既有缺陷，记录而非掩盖。

## 建议 `implement.jsonl`

清单应引用：`.trellis/spec/cli/backend/index.md`、`workflow-state-contract.md`、`commands-update.md`、`script-conventions.md`、`.trellis/spec/cli/unit-test/index.md`、`conventions.md`、`integration-patterns.md`；父任务的 `sync-call-chain.md` 与 `template-hashes.md`；以及本任务的 `workflow-runtime-parser-audit.md`、`workflow-structure-and-drift-plan.md`、`workflow-init-update-test-plan.md`。每条 `reason` 用中文说明其提供的解析器、hash、Python 兼容、测试或语言选择证据。

## 建议 `check.jsonl`

清单应引用 `workflow-state-contract.md`、`commands-update.md`、`script-conventions.md`、`quality-guidelines.md`、单测 `conventions.md` 与 `integration-patterns.md`，以及上述三份 PR1-B 研究文档。`reason` 应覆盖标签/解析器/update、hash/用户编辑保护/幂等、Python 3.9、精确非自证断言、真实文件系统测试及解析器/结构/测试矩阵交叉核对。

## 交接说明

- 若需任务自包含，应在有意识切换活动任务后，将三份 PR1-B 研究文件复制到 `.trellis/tasks/07-27-i18n-workflow-pr1b/research/`，再更新 JSONL 路径；
- 计划有意排除 README/docs-site，因为委派的 PR1-B 范围只包含翻译、结构一致性及 init/update 集成；
- 未审查且目标任务未真正成为 current 前，不得运行 `task.py start`。
